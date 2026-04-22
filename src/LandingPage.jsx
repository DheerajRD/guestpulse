import React from "react";

export default function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold">
          GC
        </div>
        <span className="text-2xl font-semibold">GoodCacuts</span>
      </div>

      {/* Heading */}
      <h1 className="text-5xl md:text-6xl font-bold text-center leading-tight max-w-4xl">
        Turn guest reviews into real decisions.
      </h1>

      {/* Subtext */}
      <p className="text-gray-500 text-center mt-6 max-w-2xl text-lg">
        Analyze reviews from Google, Yelp, and TripAdvisor to understand what
        customers love, what to fix, and how to improve your restaurant.
      </p>

      {/* CTA */}
      <button
        onClick={onStart}
        className="mt-8 px-10 py-4 bg-green-600 text-white rounded-full text-lg font-semibold shadow-md hover:scale-105 transition"
      >
        Good to Start →
      </button>

      <p className="text-gray-400 text-sm mt-4">
        Clean dashboard • AI-powered insights
      </p>

      {/* Features */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <div className="bg-gray-50 p-6 rounded-2xl text-center shadow-sm">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-lg font-semibold">Owner Insights</h3>
          <p className="text-gray-500 mt-2 text-sm">
            See performance and make smarter decisions.
          </p>
        </div>

        <div className="bg-gray-50 p-6 rounded-2xl text-center shadow-sm">
          <div className="text-3xl mb-3">💬</div>
          <h3 className="text-lg font-semibold">Customer Reviews</h3>
          <p className="text-gray-500 mt-2 text-sm">
            Understand what guests really think.
          </p>
        </div>

        <div className="bg-gray-50 p-6 rounded-2xl text-center shadow-sm">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="text-lg font-semibold">Analytics & Trends</h3>
          <p className="text-gray-500 mt-2 text-sm">
            Track growth, ratings, and sentiment.
          </p>
        </div>
      </div>
    </div>
  );
}
