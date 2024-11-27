import React, { useState, useEffect } from 'react';
import './BettingPage.css'; // Add a CSS file for styling

function BettingPage() {
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch('http://localhost:3000/market/getMarketData');
        const data = await response.json();
        setMarkets(data);
      } catch (error) {
        console.error('Error fetching markets:', error);
      }
    };

    fetchMarkets();
  }, []);

  const handleBetSubmit = async (e) => {
    e.preventDefault();
    // Handle bet submission logic
  };

  return (
    <div className="betting-page">
      <h2>Available Betting Markets</h2>
      <div className="markets-list">
        {markets.map((market) => (
          <div 
            key={market.market_id} 
            className="market-card"
            onClick={() => setSelectedMarket(market)}
          >
            <h3>{market.description}</h3>
            <p>Odds: {market.odds}</p>
            <div className="options">
              {market.options?.map((option) => (
                <button
                  key={option.option_id}
                  onClick={() => setSelectedOption(option.option_string)}
                  className={selectedOption === option.option_string ? 'selected' : ''}
                >
                  {option.option_string}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedMarket && (
        <form onSubmit={handleBetSubmit} className="bet-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="Enter bet amount"
            required
          />
          <button type="submit">Place Bet</button>
        </form>
      )}
    </div>
  );
}

export default BettingPage; 