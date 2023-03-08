import { ActorSourcePF2e } from "@actor/data";
import { ItemSourcePF2e } from "@item/data";
import { SpellcastingEntrySource } from "@item/spellcasting-entry";
import { MigrationBase } from "../base";

/** Remove ritual spellcasting entries */
export class Migration829RMRitualEntries extends MigrationBase {
    static override version = 0.829;

    override async updateActor(source: ActorSourcePF2e): Promise<void> {
        for (const item of source.items.filter((i): i is SpellcastingEntrySource => i.type === "spellcastingEntry")) {
            if (item.system.prepared.value === "ritual") {
                source.items.splice(source.items.indexOf(item), 1);
            }
        }
    }

    override async updateItem(source: ItemSourcePF2e): Promise<void> {
        if (source.type === "spell" && source.system.category.value === "ritual" && source.system.location) {
            source.system.location.value = null;
        }
    }
}
