import mongoose, { Schema } from "mongoose";

/**
 * @typedef {import('mongoose').Schema} Schema
 *
 * @typedef {Object} SubscriptionsSchema
 * @property {import('mongoose').Types.ObjectId} subscriber - The ID of the subscriber.
 * @property {import('mongoose').Types.ObjectId} channel - The ID of the channel.
 * @property {Date} createdAt - The timestamp when the subscription was created.
 * @property {Date} updatedAt - The timestamp when the subscription was last updated.
 */
const subscriptionsSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, // one who is the subscriber
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId, // one to whom the 'subscriber' is subscribing
      ref: "User",
    },
  },
  { timestamps: true },
);

export const Subscription = mongoose.model("Subscription", subscriptionsSchema);
