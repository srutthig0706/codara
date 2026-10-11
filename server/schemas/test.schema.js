const { z } = require("zod");

// AI Failure Feedback Schema (Grounded in compiler/test output + reference solution)
const ExerciseErrorFeedbackSchema = z.object({
  failureAnalysis: z.string().min(10, "Failure analysis required"),
  conceptualMisunderstanding: z.string().min(5),
  hintWithoutGivingAnswer: z.string().min(10),
  relevantDocsReference: z.string().default("")
});

// AI Reflection Follow-up Schema (Why did you choose this approach?)
const ExerciseSuccessFollowUpSchema = z.object({
  approachEvaluation: z.string().min(10, "Approach analysis required"),
  timeSpaceComplexityFeedback: z.string().min(10),
  followUpReflectionQuestion: z.string().min(10)
});

module.exports = {
  ExerciseErrorFeedbackSchema,
  ExerciseSuccessFollowUpSchema
};
