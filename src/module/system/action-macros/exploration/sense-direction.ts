import { ActionMacroHelpers, SkillActionOptions } from "..";
import { ModifierPF2e } from "@actor/modifiers";

export function senseDirection(options: SkillActionOptions) {
    const modifiers = [
        new ModifierPF2e({
            label: "PF2E.Actions.SenseDirection.Modifier.NoCompass",
            modifier: -2,
            predicate: [{ not: "compass-in-possession" }],
        }),
    ].concat(options?.modifiers ?? []);
    const slug = options?.skill ?? "survival";
    const rollOptions = ["action:sense-direction"];
    ActionMacroHelpers.simpleRollActionCheck({
        actors: options.actors,
        actionGlyph: options.glyph,
        title: "PF2E.Actions.SenseDirection.Title",
        checkContext: (opts) => ActionMacroHelpers.defaultCheckContext(opts, { modifiers, rollOptions, slug }),
        traits: ["exploration", "secret"],
        event: options.event,
        callback: options.callback,
        difficultyClass: options.difficultyClass,
        extraNotes: (selector: string) => [
            ActionMacroHelpers.note(selector, "PF2E.Actions.SenseDirection", "criticalSuccess"),
            ActionMacroHelpers.note(selector, "PF2E.Actions.SenseDirection", "success"),
        ],
    });
}
