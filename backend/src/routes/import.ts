import { Hono } from "hono";
import { z } from "zod";
import { importRecipeFromUrl } from "../services/recipe-import";

const importRouter = new Hono();

const importRecipeSchema = z.object({
  url: z.string().min(1),
});

importRouter.post("/recipe", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = importRecipeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
  }

  try {
    const recipe = await importRecipeFromUrl(parsed.data.url);
    return c.json({ data: { recipe } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return c.json({ error: message }, 422);
  }
});

export { importRouter };

