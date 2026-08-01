const { ObjectId } = require('mongodb');

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

module.exports = { toObjectId };
