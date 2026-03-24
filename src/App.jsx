import React, { useState, useEffect } from 'react';
// Keep your existing imports (Lucide icons, etc.) here

const App = () => {
  // --- 1. YOUR ORIGINAL STATES ---
  const [placeUrl, setPlaceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState(null);
  
  // --- UPDATED STATE: Store all 3 IDs ---
  const [runIds, setRunIds] = useState({
    google: null,
    yelp: null,
    trip: null
  });

  // --- 2. START SEARCH (Updated to capture 3 IDs) ---
  const handleSearch = async () => {
    if (!placeUrl) return;
    setLoading(true);
    setError(null);
    setReviews([]);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeUrl })
      });

      const data = await response.json();

      if (data.status === 'started') {
        // Save Google, Yelp, and TripAdvisor IDs
        setRunIds({
          google: data.runId,
          yelp: data.yelpRunId,
          trip: data.tripRunId
        });
        setRestaurant(data.restaurant);
      } else {
        setError(data.error || 'Failed to start');
        setLoading(false);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  // --- 3. POLLING LOGIC (Updated to check all 3 sources) ---
  useEffect(() => {
    let interval;

    if (loading && runIds.google) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'check',
              runId: runIds.google,    // Maps to 'runId' in your review.js
              yelpRunId: runIds.yelp,
              tripRunId: runIds.trip
            })
          });

          const data = await res.json();

          if (data.status === 'done') {
            // Your review.js already merged all reviews into this one array
            setReviews(data.reviews);
            setLoading(false);
            clearInterval(interval);
          } else if (data.status === 'error') {
            setError(data.error);
            setLoading(false);
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Status check failed:', err);
        }
      }, 3000); // Check every 3 seconds
    }

    return () => clearInterval(interval);
  }, [loading, runIds]);

  return (
    <div className="min-h-screen bg-white">
      {/* Keep your original Header/Nav design here.
          I am keeping the logic clean so your UI doesn't break.
      */}

      <main className="max-w-4xl mx-auto p-4">
        {/* YOUR ORIGINAL SEARCH BAR */}
        <div className="flex gap-2 mb-8">
          <input 
            type="text" 
            placeholder="Paste Google Maps URL..."
            value={placeUrl}
            onChange={(e) => setPlaceUrl(e.target.value)}
            className="flex-1 p-2 border rounded shadow-sm"
          />
          <button 
            onClick={handleSearch} 
            disabled={loading}
            className="bg-black text-white px-6 py-2 rounded disabled:bg-gray-400"
          >
            {loading ? 'Searching All Sources...' : 'Get Reviews'}
          </button>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded mb-4">{error}</div>}

        {/* YOUR ORIGINAL RESTAURANT HEADER */}
        {restaurant && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            <p className="text-gray-600">{restaurant.address}</p>
            <div className="mt-2 text-yellow-500 font-bold">
              ⭐ {restaurant.rating} ({restaurant.totalReviews} Google Reviews)
            </div>
          </div>
        )}

        {/* --- REVIEWS LIST --- */}
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <div key={index} className="p-4 border rounded-lg shadow-sm relative">
              
              {/* SOURCE TAG: Tells the user if it's Google, Yelp, or TripAdvisor */}
              <span className={`absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-1 rounded text-white ${
                review.source === 'google' ? 'bg-blue-500' : 
                review.source === 'yelp' ? 'bg-red-500' : 'bg-green-600'
              }`}>
                {review.source}
              </span>

              <div className="font-bold">{review.author}</div>
              <div className="text-yellow-500 text-sm">{'★'.repeat(Math.round(review.rating))}</div>
              <p className="mt-2 text-gray-700 italic">"{review.text}"</p>
              <div className="mt-2 text-xs text-gray-400">{review.time}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default App;
