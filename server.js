require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// PostgreSQL client setup
const pool = new Pool({
    user: 'postgres', //PostgreSQL username
    host: 'localhost',
    database: 'totally_spy', //database name
    password: '131201', // PostgreSQL password
    port: 5432,
  });

// Create an Express app
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));// so that the css and js will be load

// Signup Route
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).json({ message: "Please provide a username and password" });
  }

  try {
      // Hash the password before storing it
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
          "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
          [username, hashedPassword]
      );

      res.status(201).json({ message: "Account created successfully!", userId: result.rows[0].id });
  } catch (error) {
      if (error.code === "23505") {
          res.status(400).json({ message: "Username already exists!" });
      } else {
          console.error("Error:", error);
          res.status(500).json({ message: "Server error" });
      }
  }
});

app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/signup.html');
});


// Start Server
const port =3000; 
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});