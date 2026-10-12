/**
 * แปลง document จาก MongoDB ให้ frontend ใช้งานง่าย
 * (amount ใน DB เป็น Decimal128 ต้องแปลงเป็นตัวเลข)
 */
function formatDonation(doc) {
  return {
    id: doc._id.toString(),
    donorName: doc.donorName,
    amount: parseFloat(doc.amount.toString()),
    message: doc.message || "",
    status: doc.status,
    streamerId: doc.streamerId,
    createdAt: doc.createdAt,
  };
}

module.exports = formatDonation;
