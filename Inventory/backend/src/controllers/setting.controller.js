import { BusinessSetting } from "../models/BusinessSetting.js";

export async function getSettings(req, res) {
  let settings = await BusinessSetting.findOne();

  if (!settings) {
    settings = await BusinessSetting.create({});
  }

  res.json(settings);
}

export async function updateSettings(req, res) {
  const settings = await BusinessSetting.findOneAndUpdate({}, req.body, {
    new: true,
    runValidators: true,
    upsert: true
  });

  res.json(settings);
}
