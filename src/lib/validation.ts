import { z } from 'zod';
const text = z.string().max(20000);
const id = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const category = z.enum(['career', 'startup', 'health', 'wealth', 'relationships', 'growth']);
const number = z.number().finite().nonnegative().max(1e12);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/);
export const dataSchema = z
  .object({
    version: z.literal(1),
    startedOn: date,
    habits: z
      .array(
        z.object({
          id,
          archived: z.boolean().optional(),
          revisions: z
            .array(
              z.object({
                from: date,
                name: text.min(1),
                category,
                days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
                paused: z.boolean(),
                type: z.enum(['check', 'count', 'minutes', 'number']),
                target: number.positive(),
                unit: text,
              }),
            )
            .min(1)
            .max(500),
        }),
      )
      .max(500),
    days: z.record(
      date,
      z.object({
        priority: text,
        step: text,
        mood: z.number().int().min(1).max(5).optional(),
        energy: z.number().int().min(1).max(5).optional(),
        notes: text,
        wins: text,
        progress: text,
        obstacles: text,
        lesson: text,
        weekly: text,
        logs: z.record(id, z.union([number, z.literal('rest')])),
        sleepStart: localDateTime.optional(),
        sleepEnd: localDateTime.optional(),
      }),
    ),
    goals: z
      .array(
        z.object({
          id,
          title: text.min(1),
          category,
          horizon: z.enum(['Annual', 'Quarterly', 'Monthly', 'Weekly']),
          status: z.enum(['In progress', 'Achieved', 'Aspirational']),
          current: number,
          target: number.positive(),
          unit: text,
          due: z.union([date, z.literal('')]),
          parentId: z.union([id, z.literal('')]),
          archived: z.boolean(),
          notes: text,
        }),
      )
      .max(2000),
    goalEvents: z
      .array(
        z.object({
          id,
          goalId: id,
          date,
          title: text,
          category,
          previous: number,
          current: number,
          target: number.positive(),
          unit: text,
          achieved: z.boolean(),
          wasAchieved: z.boolean().optional(),
        }),
      )
      .max(50000)
      .optional()
      .default([]),
    finance: z
      .array(
        z
          .object({
            id,
            date,
            liquid: number,
            accessible: number,
            netWorth: number,
            securities: number.nullable(),
            property: number.nullable(),
            etf: number.max(100).nullable(),
            contributions: number.nullable(),
            notes: text,
          })
          .refine(
            (f) => f.accessible <= f.liquid,
            'Accessible assets cannot exceed liquid assets including SRS.',
          ),
      )
      .max(2000),
    sessions: z
      .array(z.object({ id, date, seconds: number.max(86400), output: text, category }))
      .max(50000),
    timer: z
      .object({
        duration: number.positive().max(14400),
        remaining: number.max(14400),
        deadline: number.nullable(),
        task: text,
        category,
      })
      .nullable(),
    theme: z.enum(['light', 'dark']),
    settings: z.object({
      bedtime: time,
      wake: time,
      sleepHours: z.number().min(1).max(16),
      displayName: z.string().max(80).optional(),
    }),
  })
  .superRefine((data, ctx) => {
    for (const key of ['habits', 'goals', 'finance', 'sessions', 'goalEvents'] as const) {
      const ids = (data[key] || []).map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', message: `Duplicate ${key} IDs` });
    }
    for (const h of data.habits)
      for (let i = 1; i < h.revisions.length; i++)
        if (h.revisions[i].from <= h.revisions[i - 1].from)
          ctx.addIssue({ code: 'custom', message: 'Habit revisions must be in date order.' });
    if (new Set(data.finance.map((f) => f.date)).size !== data.finance.length)
      ctx.addIssue({ code: 'custom', message: 'Only one financial snapshot per date.' });
    for (const goal of data.goals) {
      const seen = new Set([goal.id]);
      let p = goal.parentId;
      while (p) {
        const parent = data.goals.find((g) => g.id === p);
        if (!parent || seen.has(p)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Goal dependencies must exist and cannot form a cycle.',
          });
          break;
        }
        seen.add(p);
        p = parent.parentId;
      }
    }
  });
