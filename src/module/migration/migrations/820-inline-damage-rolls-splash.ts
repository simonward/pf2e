import { ActorSourcePF2e } from "@actor/data";
import { ItemSourcePF2e } from "@item/data";
import { recursiveReplaceString } from "@util";
import { MigrationBase } from "../base";

/** Update splash damage roll links to also be formatted to new standard */
export class Migration820InlineDamageRollsSplash extends MigrationBase {
    static override version = 0.82;

    // [[/r {2}[splash,negative]]]
    // [[/r {2}[splash, negative]]]
    // [[/r {2}[splash,negative] #Tag]]
    // [[/r {2}[splash,negative]]]{Label}
    // [[/r {2}[splash,negative] #Tag]]{Label}
    #pattern1 = /\[\[\/r\s*{([^}]*)}\[splash,\s*([^\]]*)\]\s*(#[^]]*)?\]\]/g;

    // [[/r 2[splash,negative]]]
    // [[/r 2[splash, negative]]]
    // [[/r 2[splash,negative] #Tag]]
    // [[/r 2[splash,negative]]]{Label}
    // [[/r 2[splash,negative] #Tag]]{Label}
    #pattern2 = /\[\[\/r\s*([^[]*)\[splash,\s*([^\]]*)\]\s*(#[^]]*)?\]\]/g;

    #buildSplashFormula(formula: string, damage: string, tag?: string | null): string {
        formula = formula.replace(/\s+/g, "");
        damage = damage.trim();
        tag = tag?.trim() ?? "";

        formula = ["+", "-", "*", "/"].some((o) => formula.includes(o)) ? `(${formula})` : formula;

        if (tag.length > 0) {
            return `[[/r (${formula}[splash])[${damage}] ${tag}]]`;
        } else {
            return `[[/r (${formula}[splash])[${damage}]]]`;
        }
    }

    #updateDamageFormula(text: string): string {
        text = text.replace(this.#pattern1, (_, formula: string, damage: string, tag: string) => {
            return this.#buildSplashFormula(formula, damage, tag);
        });

        text = text.replace(this.#pattern2, (_, formula: string, damage: string, tag: string) => {
            return this.#buildSplashFormula(formula, damage, tag);
        });

        return text;
    }

    override async updateActor(source: ActorSourcePF2e): Promise<void> {
        source.system = recursiveReplaceString(source.system, (s) => this.#updateDamageFormula(s));
    }

    override async updateItem(source: ItemSourcePF2e): Promise<void> {
        source.system = recursiveReplaceString(source.system, (s) => this.#updateDamageFormula(s));
    }

    override async updateJournalEntry(source: foundry.data.JournalEntrySource): Promise<void> {
        source.pages = recursiveReplaceString(source.pages, (s) => this.#updateDamageFormula(s));
    }
}
