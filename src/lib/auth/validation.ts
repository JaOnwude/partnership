import { z } from "zod";
import { normalisePhone } from "../phone";

export const loginSchema = z.object({
  phone: z.string().transform((value, ctx) => {
    const phone = normalisePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Invalid phone number" });
      return z.NEVER;
    }
    return phone;
  }),
  pin: z.string().regex(/^\d{6}$/, "PIN must be 6 digits"),
});
