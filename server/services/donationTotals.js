const Donation = require("../models/Donations");

async function getPaidDonationTotal(streamerId) {
  const donations = await Donation.find({ streamerId, status: "paid" })
    .select("amount")
    .lean();

  let total = 0;
  for (const doc of donations) {
    total += Number(doc.amount.toString());
  }
  return total;
}

module.exports = { getPaidDonationTotal };
