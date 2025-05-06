import React from 'react';

export const metadata = {
  title: 'Terms of Service | MonkeyHouse',
  description: 'Terms of Service for MonkeyHouse roommate matching service',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-8 sm:p-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4 mb-8">
            Terms of Service
          </h1>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Last Updated: {new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})}
            </p>
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">1. Agreement to Terms</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  By accessing or using MonkeyHouse, you agree to be bound by these Terms of Service. If you do not agree to these terms, 
                  please do not use our service.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">2. Description of Service</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  MonkeyHouse provides a platform to help users find compatible roommates for their internships. Our service includes 
                  profile creation, preference matching, and communication tools.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">3. User Responsibilities</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>As a user of MonkeyHouse, you agree to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li>Provide accurate and truthful information</li>
                  <li>Maintain the confidentiality of your account credentials</li>
                  <li>Use the service in a lawful and respectful manner</li>
                  <li>Not harass, intimidate, or discriminate against other users</li>
                  <li>Not use the service for any illegal or unauthorized purpose</li>
                </ul>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">4. Content and Conduct Guidelines</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  You are solely responsible for the content you post on MonkeyHouse. We reserve the right to remove content that violates 
                  these terms or our community guidelines.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">5. Account Termination</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  We reserve the right to suspend or terminate your account if you violate these terms or engage in behavior that 
                  compromises the integrity of our service.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">6. Disclaimer of Warranties</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  MonkeyHouse is provided "as is" without any warranties, expressed or implied. We do not guarantee that the service 
                  will be error-free or uninterrupted.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">7. Limitation of Liability</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  MonkeyHouse is not liable for any direct, indirect, incidental, or consequential damages arising from your use of 
                  the service or any transactions with other users.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">8. Changes to Terms</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  We may update these Terms of Service from time to time. We will notify users of significant changes via email or 
                  through the service.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">9. Contact</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  If you have questions about these Terms of Service, please contact us at: 
                  <a href="mailto:adhanaesaw@gmail.com" className="text-blue-600 dark:text-blue-400 ml-1 hover:underline">adhanaesaw@gmail.com</a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 