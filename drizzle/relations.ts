import { relations } from "drizzle-orm/relations";
import { projects, quickNotes } from "./schema";

export const quickNotesRelations = relations(quickNotes, ({one}) => ({
	project: one(projects, {
		fields: [quickNotes.projectId],
		references: [projects.id]
	}),
}));

export const projectsRelations = relations(projects, ({many}) => ({
	quickNotes: many(quickNotes),
}));