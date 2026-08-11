import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket!: WebSocket;
  private peers: { [id: string]: RTCPeerConnection } = {};
  private localStream!: MediaStream;
  private myId = this.generateId();
  // track offers in-flight to avoid duplicate offer spamming
  private inFlightOffers: Set<string> = new Set();
  // track outstanding requests for missing offers so we don't spam the server
  private pendingOfferRequests: Set<string> = new Set();
  // if server fails to forward SDPs we allow one forced-offer attempt per remote
  private forcedOfferAttempted: Set<string> = new Set();
  // optional callback to report inbound/outbound signaling frames
  private signalingCallback?: (direction: 'in' | 'out', msg: any) => void;

  private sendSignaling(payload: any) {
    try {
      const json = JSON.stringify(payload);
      this.socket?.send(json);
      try {
        this.signalingCallback?.('out', payload);
      } catch (err) {
        console.warn('signalingCallback(out) handler threw', err);
      }
    } catch (err) {
      console.warn('Could not send signaling payload:', err, payload);
    }
  }

  async start(
    roomName: string,
    onRemoteStream: (stream: MediaStream, userId: string) => void,
    onSignaling?: (direction: 'in' | 'out', msg: any) => void,
  ) {
    try {
      this.localStream = await navigator?.mediaDevices?.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err: any) {
      console.error('[SocketService] getUserMedia failed:', err);
      // re-throw so caller can show a helpful UI message
      throw err;
    }

    this.socket = new WebSocket(
      `ws://localhost:3000/ws/meetings/${roomName}`,
    );

    // register callback for signaling frames
    this.signalingCallback = onSignaling;

    // announce when socket opens so server knows about us
    this.socket.onopen = () => {
      console.log('[SocketService] connected -> sending join:', this.myId);
      this.sendSignaling({ type: 'join', id: this.myId, room: roomName });
    };

    this.socket.onclose = (ev) => {
      console.log('[SocketService] socket closed', ev);
    };

    this.socket.onerror = (err) => {
      console.error('[SocketService] socket error', err);
    };

    this.socket.onmessage = async (event) => {
      let data: any = null;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        data = event.data;
      }

      console.log('SOCKET MSG:', data);
      try {
        onSignaling?.('in', data);
      } catch (err) {
        console.warn('onSignaling(in) handler threw', err);
      }

      if (data.type === 'room-state') {
        // Server sent the current participants — create peers and offer to them
        (async () => {
          for (const user of data.participants ?? []) {
            if (!user?.id || user.id === this.myId) continue;
            if (!this.peers[user.id]) {
              this.createPeer(user.id, onRemoteStream);
            }
            // create and send offer to this participant
            await this.maybeCreateOffer(user.id);
          }
        })().catch((e) => console.error('room-state handling error', e));
      }

      if (data.type === 'user-joined') {
        const user = data?.user;
        if (!user?.id || user?.id === this.myId) return;
        if (!this.peers[user.id]) {
          this.createPeer(user.id, onRemoteStream);
        }
        // new user — create offer for them
        (async () => await this.maybeCreateOffer(user.id))().catch((e) =>
          console.error('user-joined handling error', e),
        );
      }

      if (data.type === 'participants') {
        (async () => {
          for (const user of data.participants ?? []) {
            if (!user?.id || user.id === this.myId) continue;
            if (!this.peers[user.id]) this.createPeer(user.id, onRemoteStream);
            await this.maybeCreateOffer(user.id);
          }
        })().catch((e) => console.error('participants handling error', e));
      }

      if (data?.type === 'offer') {
        // server payloads vary — try to find the SDP description and sender id
        const offerPayload = data?.offer ?? data?.data ?? null;
        const fromId = data?.from ?? data?.sender?.id ?? data?.sender ?? null;

        // If offer payload is missing, ask the server to resend full SDP for the sender
          if (!offerPayload) {
          console.warn('[SocketService] received offer message without payload:', data);
          if (fromId && !this.pendingOfferRequests.has(fromId)) {
            try {
              console.log('[SocketService] requesting offer for', fromId);
              this.sendSignaling({ type: 'request-offer', to: fromId, from: this.myId });
              this.pendingOfferRequests.add(fromId);
              // clear the request after 3s to allow retry later if needed
              setTimeout(() => {
                this.pendingOfferRequests.delete(fromId);
                // If no valid offer arrived in 3s, and we haven't forced an offer for this peer yet,
                // try a single fallback forced offer to recover the connection when server is broken.
                if (
                  fromId &&
                  !this.forcedOfferAttempted.has(fromId) &&
                  !this.inFlightOffers.has(fromId)
                ) {
                  console.log('[SocketService] no offer arrived — attempting forced offer to', fromId);
                  this.forcedOfferAttempted.add(fromId);
                  // fire-and-forget
                  this.forceCreateOffer(fromId).catch((e) =>
                    console.warn('forced offer failed', e),
                  );
                }
              }, 3000);
            } catch (e) {
              console.warn('request-offer failed', e);
            }
          }
        } else if (!fromId) {
          console.warn(
            '[SocketService] received offer but missing sender id:',
            data,
          );
        } else {
          // normalize offerPayload if it's wrapped differently (server may use data.offer or data.sdp)
          const normalized = this.normalizeSdpPayload(offerPayload);
          if (!normalized) {
            console.warn('[SocketService] offer payload could not be normalized:', offerPayload);
          } else {
            await this.handleOffer(normalized, String(fromId), onRemoteStream);
          }
        }
      }

      if (data?.type === 'answer') {
        const answerPayload = data?.answer ?? data?.data ?? null;
        const fromId = data?.from ?? data?.sender?.id ?? data?.sender ?? null;
        if (!answerPayload) {
          console.warn(
            '[SocketService] received answer message without payload:',
            data,
          );
        } else if (!fromId) {
          console.warn(
            '[SocketService] received answer but missing sender id:',
            data,
          );
        } else {
          const normalized = this.normalizeSdpPayload(answerPayload);
          if (!normalized) {
            console.warn('[SocketService] answer payload could not be normalized:', answerPayload);
          } else {
            this.handleAnswer(normalized, String(fromId));
          }
        }
      }

      if (data?.type === 'candidate') {
        // candidate might be undefined or malformed — guard accordingly
        try {
          const pc = this.peers[String(data?.from)];
          if (pc && data?.candidate) await pc.addIceCandidate(data.candidate);
        } catch (e) {
          console.warn('addIceCandidate failed', e);
        }
      }
      // back-compat accept server-sent offer-responses
      if (data?.type === 'offer-response') {
        const offerPayload = data?.offer ?? data?.data ?? null;
        const fromId = data?.from ?? data?.sender?.id ?? data?.sender ?? null;
        if (offerPayload && fromId) {
          const normalized = this.normalizeSdpPayload(offerPayload);
          if (normalized) await this.handleOffer(normalized, String(fromId), onRemoteStream);
        }
      }
    };

    return this.localStream;
  }

  private createPeer(
    userId: string,
    onRemoteStream: (stream: MediaStream, userId: string) => void,
  ) {
    // guard against invalid user ids
    if (!userId || typeof userId !== 'string') {
      console.warn('[SocketService] createPeer called with invalid userId:', userId);
      return null as any;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.localStream?.getTracks()?.forEach((track) => {
      pc?.addTrack(track, this.localStream);
    });

    pc.ontrack = (event) => {
      onRemoteStream(event?.streams[0], userId);
    };

    pc.onicecandidate = (event) => {
      if (event?.candidate) {
        this.sendSignaling({ type: 'candidate', to: userId, candidate: event?.candidate });
      }
    };

    this.peers[userId] = pc;
    console.log('[SocketService] created peer for', userId);
    return pc;
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    from: string,
    onRemoteStream: (stream: MediaStream, userId: string) => void,
  ) {
    if (!from || typeof from !== 'string') {
      console.warn('[SocketService] handleOffer: invalid from id', from);
      return;
    }

    this.createPeer(from, onRemoteStream);

    const pc = this.peers[from];

    // validate offer shape before trying to set as remote description
    if (!offer || !offer?.sdp || !offer?.type) {
      console.warn('[SocketService] handleOffer called with invalid offer:', offer);
      return;
    }

    await pc?.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc?.createAnswer();
    await pc?.setLocalDescription(answer);

    this.sendSignaling({ type: 'answer', to: from, answer });
    // clear any in-flight offer to this peer - we just answered their offer
    this.inFlightOffers.delete(from);
  }

  // helper — create an offer towards a specific remote peer if a peer exists
  private async maybeCreateOffer(remoteId: string) {
    try {
      console.log('[SocketService] maybeCreateOffer -> to', remoteId);
      // avoid duplicate in-flight offers
      if (this.inFlightOffers.has(remoteId)) {
        console.log('[SocketService] offer already in-flight, skipping ->', remoteId);
        return;
      }

      // deterministic offerer rule to avoid collisions (only higher id offers)
      if (typeof remoteId === 'string' && typeof this.myId === 'string') {
        if (this.myId <= remoteId) {
          console.log('[SocketService] not elected offerer for', remoteId, '(myId<=remoteId)');
          return;
        }
      }

      const pc = this.peers[remoteId];
      if (!pc) return;

      // make sure our local stream's tracks are added
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => {
          try {
            pc.addTrack(t, this.localStream);
          } catch (e) {
            /* ignore duplicate addTrack calls */
          }
        });
      }

      // create and send offer
      this.inFlightOffers.add(remoteId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignaling({ type: 'offer', to: remoteId, from: this.myId, offer: pc.localDescription?.toJSON() });
      console.log('[SocketService] sent offer ->', remoteId);
      // clear in-flight mark after a timeout in case no answer arrives
      setTimeout(() => this.inFlightOffers.delete(remoteId), 12000);
    } catch (e) {
      console.warn('maybeCreateOffer error:', e);
    }
  }

  private generateId(len = 8) {
    return Math.random()
      .toString(36)
      .slice(2, 2 + len);
  }

  // Attempt a single forced offer to a remote when server didn't forward a valid offer
  private async forceCreateOffer(remoteId: string) {
    if (!remoteId || typeof remoteId !== 'string') return;
    try {
      if (this.inFlightOffers.has(remoteId)) return;
      const pc = this.peers[remoteId] || this.createPeer(remoteId, () => {});
      if (!pc) return;

      // ensure tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => {
          try {
            pc.addTrack(t, this.localStream);
          } catch (e) {
            // ignore
          }
        });
      }

      this.inFlightOffers.add(remoteId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignaling({ type: 'offer', to: remoteId, from: this.myId, offer: pc.localDescription?.toJSON(), forced: true });
      console.log('[SocketService] forced offer ->', remoteId);

      // fallback: clear in-flight after timeout
      setTimeout(() => this.inFlightOffers.delete(remoteId), 15000);
    } catch (e: any) {
      console.warn('forceCreateOffer failed', e);
      this.inFlightOffers.delete(remoteId);
    }
  }

  // Normalize different shapes of SDP payloads that might arrive from server
  private normalizeSdpPayload(payload: any): RTCSessionDescriptionInit | null {
    if (!payload) return null;

    // payload may be a JSON string
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // not JSON — can't normalize
        return null;
      }
    }

    // Direct SDP object
    if (payload && payload.sdp && payload.type) {
      return { type: String(payload.type), sdp: String(payload.sdp) } as RTCSessionDescriptionInit;
    }

    // wrapped under 'offer' or 'answer'
    if (payload.offer && payload.offer.sdp) return payload.offer as RTCSessionDescriptionInit;
    if (payload.answer && payload.answer.sdp) return payload.answer as RTCSessionDescriptionInit;

    // server might send { data: { sdp, type } }
    if (payload.data && payload.data.sdp && payload.data.type)
      return payload.data as RTCSessionDescriptionInit;

    // can't normalize
    return null;
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, from: string) {
    if (!from || typeof from !== 'string') {
      console.warn('[SocketService] handleAnswer: invalid from id', from);
      return;
    }

    if (!answer || !answer?.sdp || !answer?.type) {
      console.warn('[SocketService] handleAnswer called with invalid answer:', answer);
      return;
    }

    await this.peers[from]?.setRemoteDescription(answer);
    // clear out any in-flight offer once answer arrives
    this.inFlightOffers.delete(from);
  }

  // Stop and cleanup everything: stop local stream tracks, close peers, close socket
  stop() {
    try {
      // stop local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
      }

      // close all peer connections
      Object.keys(this.peers).forEach((id) => {
        try {
          this.peers[id]?.close();
        } catch (e) {}
        delete this.peers[id];
      });

      // close socket
      try {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close();
      } catch (e) {
        console.warn('[SocketService] stop socket close failed', e);
      }

      // clear state
      this.inFlightOffers.clear();
      this.pendingOfferRequests.clear();
      this.forcedOfferAttempted.clear();
      this.localStream = undefined as any;
      this.socket = undefined as any;
      console.log('[SocketService] stopped and cleaned up');
    } catch (e) {
      console.warn('[SocketService] stop failed', e);
    }
  }
}

