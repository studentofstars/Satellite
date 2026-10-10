
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow requests from GitHub Pages and your local Vite app.
app.use(
  cors({
    origin: [
      "https://sahanacodes7.github.io",
      "http://localhost:5173",
    ],
  })
);

// Backend health check
app.get("/", (req, res) => {
  res.json({
    message: "Satellite backend is running",
  });
});

// Fetch Aditya-L1 ephemeris data from NASA Horizons
app.get("/api/aditya-l1", async (req, res) => {
  try {
    // Current time and one hour later
    const startDate = new Date();
    const stopDate = new Date(
      startDate.getTime() + 60 * 60 * 1000
    );

    // Format date for NASA Horizons
    const formatTime = (date) =>
      date.toISOString().slice(0, 16).replace("T", " ");

    const params = new URLSearchParams({
      format: "json",
      COMMAND: "'-156'",
      OBJ_DATA: "'NO'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'VECTORS'",
      CENTER: "'500@399'",
      START_TIME: `'${formatTime(startDate)}'`,
      STOP_TIME: `'${formatTime(stopDate)}'`,
      STEP_SIZE: "'1m'",
      VEC_TABLE: "'2'",
      OUT_UNITS: "'KM-S'",
      CSV_FORMAT: "'YES'",
    });

    const url =
      `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `NASA returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    // NASA may return an error inside a successful HTTP response.
    if (data.error) {
      return res.status(502).json({
        error: "NASA Horizons rejected the query",
        details: data.error,
      });
    }

    const resultText = data.result;

    if (typeof resultText !== "string") {
      return res.status(502).json({
        error: "NASA returned an unexpected response",
      });
    }

    // Extract the vector data section.
    const start = resultText.indexOf("$$SOE");
    const end = resultText.indexOf("$$EOE");

    if (start === -1 || end === -1 || end <= start) {
      return res.status(502).json({
        error: "NASA response did not contain valid vector data",
      });
    }

    const lines = resultText
      .slice(start + 5, end)
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return res.status(502).json({
        error: "NASA returned no vector records",
      });
    }

    // Use the first vector record in the requested time window.
    // Columns: Julian date, calendar date, X, Y, Z, VX, VY, VZ.
    const values = lines[0]
      .split(",")
      .map((value) => value.trim());

    if (values.length < 8) {
      return res.status(502).json({
        error: "NASA returned an incomplete vector record",
      });
    }

    const positionKm = {
      x: Number(values[2]),
      y: Number(values[3]),
      z: Number(values[4]),
    };

    const velocityKmPerSecond = {
      vx: Number(values[5]),
      vy: Number(values[6]),
      vz: Number(values[7]),
    };

    const allValues = [
      positionKm.x,
      positionKm.y,
      positionKm.z,
      velocityKmPerSecond.vx,
      velocityKmPerSecond.vy,
      velocityKmPerSecond.vz,
    ];

    if (!allValues.every(Number.isFinite)) {
      return res.status(502).json({
        error: "NASA returned invalid vector coordinates",
      });
    }

    // Calculate distance from Earth in kilometres.
    const distanceFromEarthKm = Math.sqrt(
      positionKm.x ** 2 +
      positionKm.y ** 2 +
      positionKm.z ** 2
    );

    // Send clean JSON to the frontend.
    return res.json({
      source: "NASA JPL Horizons",
      target: "Aditya-L1",
      targetId: "-156",
      referenceCenter: "Earth",
      referenceFrame: "Ecliptic J2000",
      fetchedAt: new Date().toISOString(),
      ephemerisTime: values[1],
      positionKm,
      velocityKmPerSecond,
      distanceFromEarthKm,
    });
  } catch (error) {
    console.error("Aditya-L1 request failed:", error);

    return res.status(502).json({
      error: "Unable to retrieve Aditya-L1 data from NASA Horizons",
    });
  }
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Satellite backend running on port ${PORT}`);
});
