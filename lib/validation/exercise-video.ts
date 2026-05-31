import { z } from "zod";

/**
 * Zod schema for exercise video.
 */
export const exerciseVideoSchema = z.object({
  id: z.string().optional(),
  exercise_name: z.string().min(1).max(200),
  youtube_url: z.string().url().refine(
    (url) => url.includes("youtube.com") || url.includes("youtu.be"),
    "Must be a valid YouTube URL",
  ),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  created_at: z.string().optional(),
});

export type ExerciseVideoInput = z.infer<typeof exerciseVideoSchema>;
