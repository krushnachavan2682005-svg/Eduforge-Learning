import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeSelectorComponent } from './theme-selector.component';

@Component({
  selector: 'app-theme-demo',
  standalone: true,
  imports: [CommonModule, ThemeSelectorComponent],
  template: `
    <div class="min-h-screen theme-bg p-8">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <header class="text-center mb-12">
          <h1 class="text-4xl font-bold theme-text mb-4">Credit Portal</h1>
          <p class="text-xl theme-text-secondary">
            Dynamic Theme System with Tailwind CSS
          </p>
        </header>

        <!-- Theme Selector -->
        <div class="mb-12">
          <app-theme-selector></app-theme-selector>
        </div>

        <!-- Demo Content -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <!-- Card 1: Primary Actions -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">
              Primary Actions
            </h2>
            <div class="space-y-4">
              <button
                class="w-full theme-bg-primary text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Apply for Credit
              </button>
              <button
                class="w-full border-2 theme-border theme-text py-3 px-6 rounded-lg font-medium hover:theme-bg hover:text-white transition-all"
              >
                View Applications
              </button>
              <button
                class="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Card 2: Information Display -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">
              Account Information
            </h2>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="theme-text-secondary">Credit Score:</span>
                <span class="theme-text font-semibold">750</span>
              </div>
              <div class="flex justify-between">
                <span class="theme-text-secondary">Available Credit:</span>
                <span class="theme-text font-semibold">$25,000</span>
              </div>
              <div class="flex justify-between">
                <span class="theme-text-secondary">Interest Rate:</span>
                <span class="theme-text font-semibold">4.5%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="theme-bg-primary h-2 rounded-full"
                  style="width: 75%"
                ></div>
              </div>
            </div>
          </div>

          <!-- Card 3: Recent Activity -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">
              Recent Activity
            </h2>
            <div class="space-y-4">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 theme-bg-primary rounded-full"></div>
                <div>
                  <p class="theme-text font-medium">Payment Received</p>
                  <p class="theme-text-secondary text-sm">$500 - 2 days ago</p>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div>
                  <p class="theme-text font-medium">Application Pending</p>
                  <p class="theme-text-secondary text-sm">
                    Auto Loan - 5 days ago
                  </p>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <p class="theme-text font-medium">Credit Approved</p>
                  <p class="theme-text-secondary text-sm">
                    Personal Loan - 1 week ago
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 4: Quick Stats -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">Quick Stats</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center">
                <div class="text-3xl font-bold theme-primary">12</div>
                <div class="theme-text-secondary text-sm">Active Loans</div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-bold theme-primary">$158K</div>
                <div class="theme-text-secondary text-sm">Total Credit</div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-bold theme-primary">98%</div>
                <div class="theme-text-secondary text-sm">On-time Payments</div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-bold theme-primary">5</div>
                <div class="theme-text-secondary text-sm">Years History</div>
              </div>
            </div>
          </div>

          <!-- Card 5: Form Example -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">
              Quick Application
            </h2>
            <form class="space-y-4">
              <div>
                <label
                  class="block theme-text-secondary text-sm font-medium mb-1"
                  >Loan Amount</label
                >
                <input
                  type="number"
                  class="w-full px-3 py-2 border theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label
                  class="block theme-text-secondary text-sm font-medium mb-1"
                  >Loan Type</label
                >
                <select
                  class="w-full px-3 py-2 border theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
                >
                  <option>Personal Loan</option>
                  <option>Auto Loan</option>
                  <option>Home Loan</option>
                </select>
              </div>
              <button
                type="submit"
                class="w-full theme-bg-primary text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Submit Application
              </button>
            </form>
          </div>

          <!-- Card 6: Font Weights Demo -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">
              Afacad Flux Font Demo
            </h2>
            <div class="space-y-3">
              <p class="theme-text font-normal text-lg">
                Regular (400) - Afacad Flux Local Font
              </p>
              <p class="theme-text font-medium text-lg">
                Medium (500) - Beautiful typography
              </p>
              <p class="theme-text font-semibold text-lg">
                SemiBold (600) - Enhanced readability
              </p>
              <p class="theme-text font-bold text-lg">
                Bold (700) - Strong emphasis
              </p>
              <div class="mt-4 p-3 theme-bg border-l-4 theme-border rounded">
                <p class="theme-text-secondary text-sm">
                  ✓ Local fonts loaded from src/assets/fonts/
                </p>
                <p class="theme-text-secondary text-sm">
                  ✓ No external CDN dependencies
                </p>
                <p class="theme-text-secondary text-sm">
                  ✓ SSR compatible and performant
                </p>
              </div>
            </div>
          </div>

          <!-- Card 7: Notifications -->
          <div class="theme-bg-secondary rounded-xl p-6 shadow-lg">
            <h2 class="text-2xl font-semibold theme-text mb-4">
              Notifications
            </h2>
            <div class="space-y-3">
              <div class="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                <p class="text-blue-700 text-sm">
                  Your credit score has improved by 15 points!
                </p>
              </div>
              <div
                class="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded"
              >
                <p class="text-yellow-700 text-sm">
                  Payment due in 3 days - $234.50
                </p>
              </div>
              <div class="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                <p class="text-green-700 text-sm">
                  Auto-pay has been successfully set up
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="mt-16 text-center">
          <p class="theme-text-secondary">
            Built with Angular 20 & Tailwind CSS | Dynamic Theme System
          </p>
        </footer>
      </div>
    </div>
  `,
})
export class ThemeDemoComponent {}
