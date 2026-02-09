const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 8080;

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 24;

function isValidLatLng(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);

  return (
    !isNaN(latNum) &&
    !isNaN(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180
  );
}

app.get("/", (req, res) => {
    res.json('Welcome zip-to-coords API for United States zip codes from 1-99950')
})

app.get("/zipcode/:zip", async (req, res) => {
  const { zip } = req.params;

  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: "Invalid ZIP code" });
  }

  const cached = cache.get(`zip:${zip}`);
  if (cached && cached.expires > Date.now()) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const url = "https://nominatim.openstreetmap.org/search";

    const { data } = await axios.get(url, {
      params: {
        postalcode: zip,
        country: "US",
        format: "json",
        limit: 1
      },
      headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/"
      }
    });

    if (!data.length) {
      return res.status(404).json({ error: "ZIP code not found" });
    }

    const response = {
      zip,
      latitude: +data[0].lat,
      longitude: +data[0].lon
    };

    // SAVE TO CACHE
    cache.set(`zip:${zip}`, {
      data: response,
      expires: Date.now() + CACHE_TTL
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch coordinates" });
  }
});

app.get("/coords", async (req, res) => {
  const { lat, lng } = req.query;
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const cacheKey = `coords:${lat},${lng}`;  

  if (!isValidLatLng(lat, lng)) {
    return res.status(400).json({
      error: "Invalid coordinates",
      example: "/coords?lat=40.7648&lng=-73.9808"
    });
  }

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat or lng query params" });
  }

  const { data } = await axios.get(url, {
  headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/"
      }
});

  const response = {
      zip: data.address.postcode,
      city: data.address.city || data.address.town || data.address.village,
      state: data.address.state,
      state_code: data.address.state_code
    };

    // CACHE RESULT
  cache.set(cacheKey, {
    data: response,
    expires: Date.now() + CACHE_TTL
  });

  res.json(response);
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});