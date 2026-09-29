import { Party } from "../models/Party.js";

export async function getParties(req, res) {
  const filter = req.query.type ? { type: req.query.type } : {};
  const parties = await Party.find(filter).sort({ createdAt: -1 });
  res.json(parties);
}

export async function createParty(req, res) {
  try {
    const party = await Party.create(req.body);
    res.status(201).json(party);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function updateParty(req, res) {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    res.json(party);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function deleteParty(req, res) {
  const party = await Party.findByIdAndDelete(req.params.id);

  if (!party) {
    return res.status(404).json({ message: "Party not found" });
  }

  res.json({ message: "Party deleted" });
}
