const { z } = require("zod");

// Citation Schema: Strict source attribution
const CitationSchema = z.object({
  sourceName: z.string().min(1),
  sourceUrl: z.string().url("Must be a valid verified documentation URL"),
  relevance: z.string().optional()
});

// 1. Explain Schema
const ExplainResponseSchema = z.object({
  concept: z.string().min(1),
  summary: z.string().min(10, "Summary must be at least 10 characters"),
  coreMechanism: z.string().min(10, "Core mechanism must be explained"),
  realWorldAnalogy: z.string().min(10, "Real-world analogy is required"),
  keyTakeaway: z.string().min(5),
  citations: z.array(CitationSchema).default([])
});

// React Flow Node & Edge Schemas
const FlowNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["client", "server", "database", "cache", "queue", "bottleneck", "service", "default"]).default("default"),
  isProblemNode: z.boolean().default(false),
  details: z.string().default("")
});

const FlowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  animated: z.boolean().default(false),
  isFailingEdge: z.boolean().default(false)
});

// 2. Scenario Schema: With vs Without Architecture
const ScenarioResponseSchema = z.object({
  scenarioTitle: z.string().min(3),
  contextDescription: z.string().min(10),
  withoutTech: z.object({
    narrative: z.string().min(10),
    problemPoints: z.array(z.string()).min(1),
    nodes: z.array(FlowNodeSchema).min(2),
    edges: z.array(FlowEdgeSchema).min(1)
  }),
  withTech: z.object({
    narrative: z.string().min(10),
    benefitsRealized: z.array(z.string()).min(1),
    nodes: z.array(FlowNodeSchema).min(2),
    edges: z.array(FlowEdgeSchema).min(1)
  }),
  citations: z.array(CitationSchema).default([])
});

/**
 * Validates graph integrity:
 * 1. Every edge's source and target must exist in the node list.
 * 2. In withTech, at least one node must represent the technology.
 */
function validateScenarioGraph(scenarioData, techSlug) {
  const errors = [];

  // Check withoutTech edges
  const withoutNodeIds = new Set(scenarioData.withoutTech.nodes.map(n => n.id));
  for (const edge of scenarioData.withoutTech.edges) {
    if (!withoutNodeIds.has(edge.source)) {
      errors.push(`withoutTech edge '${edge.id}' has missing source node '${edge.source}'`);
    }
    if (!withoutNodeIds.has(edge.target)) {
      errors.push(`withoutTech edge '${edge.id}' has missing target node '${edge.target}'`);
    }
  }

  // Check withTech edges
  const withNodeIds = new Set(scenarioData.withTech.nodes.map(n => n.id));
  for (const edge of scenarioData.withTech.edges) {
    if (!withNodeIds.has(edge.source)) {
      errors.push(`withTech edge '${edge.id}' has missing source node '${edge.source}'`);
    }
    if (!withNodeIds.has(edge.target)) {
      errors.push(`withTech edge '${edge.id}' has missing target node '${edge.target}'`);
    }
  }

  // Check technology node presence in withTech
  const normalizedSlug = techSlug.toLowerCase();
  const techNodeFound = scenarioData.withTech.nodes.some(node => {
    const labelLower = node.label.toLowerCase();
    const idLower = node.id.toLowerCase();
    return labelLower.includes(normalizedSlug) || idLower.includes(normalizedSlug);
  });

  if (!techNodeFound) {
    errors.push(`withTech graph must contain a node representing the technology '${techSlug}'`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  CitationSchema,
  ExplainResponseSchema,
  FlowNodeSchema,
  FlowEdgeSchema,
  ScenarioResponseSchema,
  validateScenarioGraph
};
