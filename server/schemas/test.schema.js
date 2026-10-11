const { z } = require("zod");

const stringOrArrayString = () =>
  z.union([
    z.string().min(5),
    z.array(z.string()).min(1).transform((arr) => arr.join(" "))
  ]);

// AI Failure Feedback Schema (Grounded in compiler/test output + reference solution)
const ExerciseErrorFeedbackSchema = z.object({
  failureAnalysis: stringOrArrayString(),
  conceptualMisunderstanding: stringOrArrayString(),
  hintWithoutGivingAnswer: stringOrArrayString(),
  relevantDocsReference: z.string().default("")
});

// AI Reflection Follow-up Schema (Why did you choose this approach?)
const ExerciseSuccessFollowUpSchema = z.object({
  approachEvaluation: stringOrArrayString(),
  timeSpaceComplexityFeedback: stringOrArrayString(),
  followUpReflectionQuestion: stringOrArrayString()
});

const QuizSubmitSchema = z.object({
  answers: z.record(z.string(), z.number())
});

const ExerciseSubmitSchema = z.object({
  code: z.string().min(1, "Code cannot be empty")
});

module.exports = {
  ExerciseErrorFeedbackSchema,
  ExerciseSuccessFollowUpSchema,
  QuizSubmitSchema,
  ExerciseSubmitSchema
};
