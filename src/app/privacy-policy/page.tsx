import React from 'react';

export const metadata = {
  title: 'Privacy Policy | MonkeyHouse',
  description: 'Privacy Policy for MonkeyHouse roommate matching service',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-8 sm:p-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4 mb-8">
            Privacy Policy
          </h1>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Last Updated: {new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})}
            </p>
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Introduction</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  MonkeyHouse ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
                  use, and safeguard your information when you use our roommate matching service.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Information We Collect</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>We collect information that you provide directly to us, including:</p>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li>Personal information (name, email address)</li>
                  <li>Demographic information (gender, location, internship details)</li>
                  <li>Preferences for roommate matching</li>
                  <li>Other information provided in survey</li>
                  <li>Communications with other users</li>
                </ul>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">How We Use Your Information</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li>Match you with potential roommates based on your preferences</li>
                  <li>Provide, maintain, and improve our services</li>
                  <li>Communicate with you about our services</li>
                  <li>Monitor and analyze usage patterns</li>
                  <li>Protect against, identify, and prevent fraud and other illegal activities</li>
                </ul>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Sharing Your Information</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  We may share certain information with other users as part of the matching process. 
                  We do not sell your personal information to third parties. 
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Data Security</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  We implement appropriate security measures to protect your personal information. 
                  However, no method of transmission over the Internet is completely secure.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Your Rights</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  You have the right to access, correct, or delete your personal information. 
                  You can update your information through your account settings or contact us for assistance.
                </p>
              </div>
            </section>

            <section className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Contact Us</h2>
              <div className="text-gray-600 dark:text-gray-300">
                <p>
                  If you have questions about this Privacy Policy, please contact us at: 
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