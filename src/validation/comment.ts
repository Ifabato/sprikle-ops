import { z } from "zod";
import { commentBodySchema } from "./common";

export const commentSchema = z.strictObject({
  body: commentBodySchema,
});
export type CommentInput = z.output<typeof commentSchema>;
