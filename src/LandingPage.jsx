import React from "react";

export default function LandingPage({ onStart }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 44,
            height: 44,
            background: "#16a34a",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          GC
        </div>
        <span style={{ fontSize: 32, fontWeight: 700 }}>GoodCacuts</span>
      </div>

      <h1
        style={{
          fontSize: "clamp(40px, 7vw, 72px)",
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.1,
          maxWidth: 900,
          margin: 0,
        }}
      >
        Turn guest reviews into real decisions.
      </h1>

      <p
        style={{
          color: "#6b7280",
          textAlign: "center",
          marginTop: 24,
          maxWidth: 760,
          fontSize: 22,
          lineHeight: 1.6,
        }}
      >
        Analyze reviews from Google, Yelp, and TripAdvisor to understand what
        customers love, what to fix, and how to improve your restaurant.
      </p>

      <button
        onClick={onStart}
        style={{
          marginTop: 32,
          padding: "16px 34px",
          background: "#16a34a",
          color: "#ffffff",
          border: "none",
          borderRadius: 999,
          fontSize: 22,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(22,163,74,0.18)",
        }}
      >
        Good to Start →
      </button>

      <p
        style={{
          color: "#9ca3af",
          fontSize: 14,
          marginTop: 18,
          marginBottom: 0,
        }}
      >
        Clean dashboard • AI-powered insights
      </p>

      <div
        style={{
          marginTop: 70,
          width: "100%",
          maxWidth: 1100,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 24,
        }}
      >
        <div
          style={{
            background: "#f9fafb",
            padding: 28,
            borderRadius: 24,
            textAlign: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            border: "1px solid #f1f5f9",
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 12 }}>📊</div>
          <h3 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>Owner Insights</h3>
          <p style={{ color: "#6b7280", fontSize: 18, lineHeight: 1.6, margin: 0 }}>
            See performance and make smarter decisions.
          </p>
        </div>

        <div
          style={{
            background: "#f9fafb",
            padding: 28,
            borderRadius: 24,
            textAlign: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            border: "1px solid #f1f5f9",
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 12 }}>💬</div>
          <h3 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>Customer Reviews</h3>
          <p style={{ color: "#6b7280", fontSize: 18, lineHeight: 1.6, margin: 0 }}>
            Understand what guests really think.
          </p>
        </div>

        <div
          style={{
            background: "#f9fafb",
            padding: 28,
            borderRadius: 24,
            textAlign: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            border: "1px solid #f1f5f9",
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 12 }}>📈</div>
          <h3 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>Analytics & Trends</h3>
          <p style={{ color: "#6b7280", fontSize: 18, lineHeight: 1.6, margin: 0 }}>
            Track growth, ratings, and sentiment.
          </p>
        </div>
      </div>
    </div>
  );
}
