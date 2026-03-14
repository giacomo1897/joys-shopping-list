const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      items: [],
      categories: ["Essen", "Kleider", "Schmuck"],
    };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// --- Items ---
app.get("/api/items", (req, res) => {
  res.json(readData().items);
});

app.post("/api/items", (req, res) => {
  const data = readData();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: req.body.name,
    quantity: req.body.quantity || "",
    price: req.body.price != null ? Number(req.body.price) : 0,
    priority: req.body.priority || "normal",
    category: req.body.category || "",
    bought: false,
    createdAt: new Date().toISOString(),
  };
  data.items.push(item);
  writeData(data);
  res.status(201).json(item);
});

app.put("/api/items/:id", (req, res) => {
  const data = readData();
  const idx = data.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  data.items[idx] = { ...data.items[idx], ...req.body };
  writeData(data);
  res.json(data.items[idx]);
});

app.delete("/api/items/:id", (req, res) => {
  const data = readData();
  data.items = data.items.filter((i) => i.id !== req.params.id);
  writeData(data);
  res.status(204).end();
});

app.delete("/api/items", (req, res) => {
  const data = readData();
  data.items = data.items.filter((i) => !i.bought);
  writeData(data);
  res.status(204).end();
});

// --- Categories ---
app.get("/api/categories", (req, res) => {
  res.json(readData().categories);
});

app.post("/api/categories", (req, res) => {
  const data = readData();
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "Name required" });
  if (data.categories.includes(name)) return res.status(409).json({ error: "Exists" });
  data.categories.push(name);
  writeData(data);
  res.status(201).json(data.categories);
});

app.delete("/api/categories/:name", (req, res) => {
  const data = readData();
  const name = decodeURIComponent(req.params.name);
  data.categories = data.categories.filter((c) => c !== name);
  data.items = data.items.map((i) => (i.category === name ? { ...i, category: "" } : i));
  writeData(data);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Einkaufsliste läuft auf http://localhost:${PORT}`);
});
