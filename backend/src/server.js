const express = require("express");
require("dotenv").config();
const app = require("./app");
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
app.use("/uploads", express.static("uploads"));
