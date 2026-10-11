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

const ComparePresetSchema = z.enum(["10x-users", "beginner-team", "offline-support"]);
const CompareRequestSchema = z.object({
  technologies: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(2).max(3),
  projectDescription: z.string().trim().min(1).max(300),
  whatIfPreset: ComparePresetSchema.optional()
}).superRefine((request, context) => {
  if (new Set(request.technologies).size !== request.technologies.length) {
    context.addIssue({
      code: "custom",
      path: ["technologies"],
      message: "Select each technology only once."
    });
  }
});

const CompareResponseSchema = z.object({
  projectDescription: z.string().min(1),
  whatIfPreset: ComparePresetSchema.nullable(),
  technologiesCompared: z.array(z.string().min(1)).min(2).max(3),
  diagrams: z.array(z.object({
    techSlug: z.string().min(1),
    evidenceStatus: z.enum(["verified", "insufficient"]),
    evidenceNote: z.string().min(1),
    nodes: z.array(FlowNodeSchema).min(1),
    edges: z.array(FlowEdgeSchema)
  })).min(2).max(3),
  tradeoffMatrix: z.array(z.object({
    criterion: z.string().min(1),
    ratings: z.record(z.string(), z.object({
      easier: z.string().min(1),
      harder: z.string().min(1),
      breaks: z.string().min(1)
    }))
  })).min(1),
  recommendedChoice: z.string().min(1),
  recommendationReason: z.string().min(1),
  sources: z.array(z.object({
    sourceId: z.string().min(1),
    techSlug: z.string().min(1),
    sourceName: z.string().min(1),
    sourceUrl: z.string().url(),
    relevance: z.string().optional()
  }))
});

function normalizeTechnologyText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Checks comparison topology and citation provenance against this request's sources.
 */
function validateCompareResponse(compareData, technologies, retrievedChunks, expected = {}) {
  const errors = [];
  const chunksById = new Map(retrievedChunks.map(chunk => [chunk.id, chunk]));
  const technologySlugs = technologies.map(technology => technology.slug);
  const expectedSlugs = new Set(technologySlugs);
  const actualSlugs = compareData.technologiesCompared;

  if (expected.projectDescription !== undefined &&
      compareData.projectDescription !== expected.projectDescription) {
    errors.push("projectDescription must match the submitted project description");
  }
  if (Object.hasOwn(expected, "whatIfPreset") &&
      compareData.whatIfPreset !== (expected.whatIfPreset || null)) {
    errors.push("whatIfPreset must match the selected preset");
  }

  if (actualSlugs.length !== technologySlugs.length ||
      technologySlugs.some(slug => !actualSlugs.includes(slug)) ||
      actualSlugs.some(slug => !expectedSlugs.has(slug))) {
    errors.push("technologiesCompared must exactly match the selected catalog technologies");
  }

  if (compareData.diagrams.length !== technologySlugs.length) {
    errors.push("There must be exactly one diagram for every selected technology");
  }

  for (const row of compareData.tradeoffMatrix) {
    const ratingSlugs = Object.keys(row.ratings);
    if (ratingSlugs.length !== technologySlugs.length ||
        technologySlugs.some(slug => !Object.hasOwn(row.ratings, slug))) {
      errors.push(`Trade-off '${row.criterion}' must include exactly one rating for every selected technology`);
    }
  }

  for (const technology of technologies) {
    const diagram = compareData.diagrams.find(item => item.techSlug === technology.slug);
    if (!diagram) {
      errors.push(`Missing diagram for technology '${technology.slug}'`);
      continue;
    }

    const normalizedNames = [technology.slug, technology.name].map(normalizeTechnologyText);
    const includesTechnology = diagram.nodes.some(node => {
      const nodeText = normalizeTechnologyText(`${node.id} ${node.label}`);
      return normalizedNames.some(name => name && nodeText.includes(name));
    });
    if (!includesTechnology) {
      errors.push(`Diagram for '${technology.slug}' must contain a node representing that technology`);
    }

    const nodeIds = new Set(diagram.nodes.map(node => node.id));
    if (nodeIds.size !== diagram.nodes.length) {
      errors.push(`Diagram for '${technology.slug}' contains duplicate node ids`);
    }
    for (const edge of diagram.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push(`Diagram for '${technology.slug}' has edge '${edge.id}' referencing a missing node`);
      }
    }

    const techChunks = retrievedChunks.filter(chunk => chunk.techSlug === technology.slug);
    const techSources = compareData.sources.filter(source => source.techSlug === technology.slug);
    if (techChunks.length === 0) {
      if (diagram.evidenceStatus !== "insufficient") {
        errors.push(`Diagram for '${technology.slug}' must state that verified sources are unavailable`);
      }
      if (diagram.nodes.length !== 1 || diagram.edges.length !== 0) {
        errors.push(`Diagram for '${technology.slug}' must not invent architecture without retrieved sources`);
      }
      for (const rating of compareData.tradeoffMatrix.flatMap(row => row.ratings[technology.slug] || [])) {
        for (const field of ["easier", "harder", "breaks"]) {
          if (!/no relevant source|insufficient|cannot assess|unavailable/i.test(rating[field])) {
            errors.push(`Trade-off '${field}' for '${technology.slug}' must disclose insufficient evidence`);
          }
        }
      }
    } else {
      if (diagram.evidenceStatus !== "verified") {
        errors.push(`Diagram for '${technology.slug}' has retrieved sources and must be marked verified`);
      }
      if (diagram.nodes.length < 2 || diagram.edges.length < 1) {
        errors.push(`Verified diagram for '${technology.slug}' must have connected architecture nodes`);
      }
      if (!techSources.length) {
        errors.push(`At least one retrieved source must be cited for '${technology.slug}'`);
      }
    }
  }

  for (const source of compareData.sources) {
    const chunk = chunksById.get(source.sourceId);
    if (!chunk) {
      errors.push(`Source '${source.sourceId}' does not exist in the retrieved chunks`);
      continue;
    }
    if (source.techSlug !== chunk.techSlug ||
        source.sourceName !== chunk.sourceName ||
        source.sourceUrl !== chunk.sourceUrl) {
      errors.push(`Source '${source.sourceId}' metadata does not match the retrieved chunk`);
    }
  }

  const missingEvidence = technologies.some(technology =>
    !retrievedChunks.some(chunk => chunk.techSlug === technology.slug)
  );
  if (missingEvidence && compareData.recommendedChoice !== "insufficient-evidence") {
    errors.push("A recommendation cannot be made when a selected technology has no retrieved source");
  } else if (!missingEvidence && !expectedSlugs.has(compareData.recommendedChoice)) {
    errors.push("recommendedChoice must be one of the selected technology slugs");
  }

  return { isValid: errors.length === 0, errors };
}

function createCompareResponseSchema(technologies, retrievedChunks, expected = {}) {
  return CompareResponseSchema.superRefine((compareData, context) => {
    const validation = validateCompareResponse(compareData, technologies, retrievedChunks, expected);
    for (const message of validation.errors) {
      context.addIssue({ code: "custom", message });
    }
  });
}

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
  CompareRequestSchema,
  validateScenarioGraph,
  ComparePresetSchema,
  CompareResponseSchema,
  createCompareResponseSchema,
  validateCompareResponse
};
