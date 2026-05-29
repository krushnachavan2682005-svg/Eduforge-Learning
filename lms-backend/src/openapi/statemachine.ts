const states = [
  "DRAFT",
  "SUBMITTED",
  "QUEUED",
  "EVALUATING",
  "EVALUATED",
  "PARTIALLY_EVALUATED",
  "FAILED",
  "TIMED_OUT"
];
const transitions = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["QUEUED"],
  QUEUED: ["EVALUATING", "FAILED"],
  EVALUATING: ["EVALUATED", "PARTIALLY_EVALUATED", "FAILED"],
  PARTIALLY_EVALUATED:["EVALUATED"],
  TIMED_OUT:["QUEUED"]
  

};
function CanTransition(current:string,next:string){
let currentTransition=transitions[current]

if(!currentTransition){
    return true
}
if(currentTransition.includes(next)){
    return true
}
return false
}
console.log(CanTransition("DRAFT","SUBMITTED"))