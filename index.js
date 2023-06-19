const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

// middleware
app.use(cors());
app.use(express.json());
const client = new MongoClient(
  `mongodb+srv://${process.env.USER_BUCKET}:${process.env.SECRET_KEY}@cluster0.mnvzcly.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  }
);

const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .send({ err: true, message: "Unauthorized access" });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  } else {
    return res.status(401).send({ err: true, message: "Unauthorized access" });
  }
};

async function run() {
  try {
    app.get("/", (req, res) =>
      res.send(`Ashta Banjan Restaurants PORT:${port}`)
    );
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");

    const userCollection = client
      .db("ashtaBanjanDB")
      .collection("userCollection");

    const menuCollection = client
      .db("ashtaBanjanDB")
      .collection("menuCollection");

    const reviewCollection = client
      .db("ashtaBanjanDB")
      .collection("reviewCollection");

    const cartCollection = client
      .db("ashtaBanjanDB")
      .collection("cartCollection");

    // JWT
    app.post("/jwt", (req, res) => {
      const data = req.body;
      const token = jwt.sign(data, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const uid = req.decoded.uid;
      const result = await userCollection.findOne({ uid: { $eq: uid } });
      if (result.role !== "admin") {
        res.status(403).send({ err: true, message: "forbidden access" });
      }
      next();
    };

    // ADMIN SECTION =======================
    app.get("/user", verifyJWT, verifyAdmin, async (req, res) => {
      const results = await userCollection.find().toArray();
      res.send(results);
    });

    app.get("/user/admin/:uid", verifyJWT, async (req, res) => {
      const uid = req.params.uid;
      if (uid !== req.decoded.uid) {
        res.send({ err: true, message: "you are not an admin" });
      }
      const result = await userCollection.findOne({ uid: { $eq: uid } });
      res.send(result);
    });

    app.post("/user", async (req, res) => {
      const data = req.body;
      const isExist = await userCollection.findOne({ uid: { $eq: data.uid } });
      if (!isExist) {
        const result = await userCollection.insertOne(data);
        res.send(result);
      }
      res.send({ message: "user exist" });
    });

    app.patch("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: data.role,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // USERS SECTION =======================
    app.get("/menu", async (req, res) => {
      const results = await menuCollection.find().toArray();
      res.send(results);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await menuCollection.insertOne(data);
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: data.name,
          price: data.price,
          recipe: data.recipe,
        },
      };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/count", async (req, res) => {
      const total = (
        await menuCollection
          .find({ category: { $eq: req.query.category } })
          .toArray()
      ).length;
      res.send({ total });
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      if (req?.query?.uid === req?.decoded?.uid) {
        const results = await cartCollection
          .find({ uid: { $eq: req.query.uid } })
          .toArray();
        res.send(results);
      } else {
        res.status(403).send({ err: true, message: "Forbidden token" });
      }
    });

    app.post("/carts", async (req, res) => {
      const data = req.body;
      const results = await cartCollection.insertOne(data);
      res.send(results);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/category", async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 6;
      const skip = page * limit;
      const results = await menuCollection
        .find({ category: { $eq: req.query.category } })
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(results);
    });

    // GET Review
    app.get("/review", async (req, res) => {
      const results = await reviewCollection.find().toArray();
      res.send(results);
    });
  } finally {
    app.listen(port, () => console.log("Ashta Banjan Server is running", port));
  }
}
run().catch(console.dir);
