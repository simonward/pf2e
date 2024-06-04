import { CreaturePF2e, type CharacterPF2e } from "@actor";
import type { ActorPF2e, ActorUpdateOperation } from "@actor/base.ts";
import { CreatureSaves, LabeledSpeed } from "@actor/creature/data.ts";
import { ActorSizePF2e } from "@actor/data/size.ts";
import { createEncounterRollOptions, setHitPointsRollOptions } from "@actor/helpers.ts";
import { ModifierPF2e, applyStackingRules } from "@actor/modifiers.ts";
import { SaveType } from "@actor/types.ts";
import { SAVE_TYPES, SKILL_EXPANDED, SKILL_SLUGS } from "@actor/values.ts";
import type { ItemType } from "@item/base/data/index.ts";
import type { CombatantPF2e, EncounterPF2e } from "@module/encounter/index.ts";
import type { RuleElementPF2e } from "@module/rules/index.ts";
import type { UserPF2e } from "@module/user/document.ts";
import type { TokenDocumentPF2e } from "@scene";
import { Predicate } from "@system/predication.ts";
import { ArmorStatistic, HitPointsStatistic, PerceptionStatistic, Statistic } from "@system/statistic/index.ts";
import * as R from "remeda";
import { FamiliarSource, FamiliarSystemData } from "./data.ts";

class FamiliarPF2e<TParent extends TokenDocumentPF2e | null = TokenDocumentPF2e | null> extends CreaturePF2e<TParent> {
    /** The familiar's attack statistic, for the rare occasion it must make an attack roll */
    declare attackStatistic: Statistic;

    override get allowedItemTypes(): (ItemType | "physical")[] {
        return [...super.allowedItemTypes, "action"];
    }

    /** The familiar's master, if selected */
    get master(): CharacterPF2e | null {
        // The Actors world collection needs to be initialized for data preparation
        if (!game.ready || !this.system.master.id) return null;

        const master = game.actors.get(this.system.master.id ?? "");
        if (master?.isOfType("character")) {
            master.familiar ??= this;
            return master;
        }

        return null;
    }

    get masterAttributeModifier(): number {
        this.system.master.ability ||= "cha";
        return this.master?.system.abilities[this.system.master.ability].mod ?? 0;
    }

    /** @deprecated for internal use but not rule elements referencing it until a migration is in place. */
    get masterAbilityModifier(): number {
        return this.masterAttributeModifier;
    }

    override get combatant(): CombatantPF2e<EncounterPF2e> | null {
        return this.master?.combatant ?? null;
    }

    /** Re-render the sheet if data preparation is called from the familiar's master */
    override reset({ fromMaster = false } = {}): void {
        super.reset();
        if (fromMaster) this.sheet.render();
    }

    /** Set base emphemeral data for later updating by derived-data preparation. */
    override prepareBaseData(): void {
        this.system.details = {
            alliance: null,
            creature: this.system.details.creature,
            languages: { value: [], details: "" },
            level: { value: 0 },
        };

        this.system.traits = {
            value: ["minion"],
            rarity: "common",
            size: new ActorSizePF2e({ value: "tiny" }),
        };

        super.prepareBaseData();

        // A familiar "[...] can never benefit from item bonuses." (CRB pg 217)
        const isItemBonus = new Predicate(["bonus:type:item"]);
        this.synthetics.modifierAdjustments.all.push({
            slug: null,
            test: (options) => isItemBonus.test(options),
            suppress: true,
        });

        type PartialSystemData = DeepPartial<FamiliarSystemData> & {
            attributes: { speed: RawSpeed; flanking: {} };
            details: {};
        };
        type RawSpeed = { value: number; otherSpeeds: LabeledSpeed[] };

        const system: PartialSystemData = this.system;
        system.attributes.flanking.canFlank = false;
        system.perception = {
            senses: [
                {
                    type: "low-light-vision",
                    acuity: "precise",
                    range: Infinity,
                },
            ],
        };
        system.attributes.speed = {
            value: 25,
            total: 25,
            label: CONFIG.PF2E.speedTypes.land,
            otherSpeeds: [],
        };

        system.attributes.reach = { base: 0, manipulate: 0 };

        system.skills = {};

        system.saves = {
            fortitude: {},
            reflex: {},
            will: {},
        };

        const { master } = this;
        this.system.details.level.value = master?.level ?? 0;
        this.rollOptions.all[`self:level:${this.level}`] = true;
        system.details.alliance = master?.alliance ?? "party";

        // Set encounter roll options from the master's perspective
        if (master) {
            this.flags.pf2e.rollOptions.all = fu.mergeObject(
                this.flags.pf2e.rollOptions.all,
                createEncounterRollOptions(master),
            );
        }
    }

    /** Skip rule-element preparation if there is no master */
    protected override prepareRuleElements(): RuleElementPF2e[] {
        return this.master ? super.prepareRuleElements() : [];
    }

    override prepareDerivedData(): void {
        super.prepareDerivedData();

        const { level, master, masterAttributeModifier, system } = this;
        const { attributes, traits } = system;

        // Ensure uniqueness of traits
        traits.value = [...this.traits].sort();
        const masterLevel = game.pf2e.settings.variants.pwol.enabled ? 0 : level;

        const speeds = (attributes.speed = this.prepareSpeed("land"));
        speeds.otherSpeeds = (["burrow", "climb", "fly", "swim"] as const).flatMap((m) => this.prepareSpeed(m) ?? []);

        // Hit Points
        const hitPoints = new HitPointsStatistic(this, { baseMax: level * 5 });
        this.system.attributes.hp = hitPoints.getTraceData();
        setHitPointsRollOptions(this);

        // Armor Class
        const masterModifier = master
            ? new ModifierPF2e({
                  label: "PF2E.Actor.Familiar.Master.ArmorClass",
                  slug: "base",
                  modifier: master.armorClass.modifiers
                      .filter((m) => m.enabled && !["status", "circumstance"].includes(m.type))
                      .reduce((total, modifier) => total + modifier.value, 0),
              })
            : null;

        const statistic = new ArmorStatistic(this, { modifiers: R.compact([masterModifier]) });
        this.armorClass = statistic.dc;
        system.attributes.ac = fu.mergeObject(statistic.getTraceData(), { attribute: statistic.attribute ?? "dex" });

        // Saving Throws
        this.saves = SAVE_TYPES.reduce(
            (partialSaves, saveType) => {
                const save = master?.saves[saveType];
                const source = save?.modifiers.filter((m) => !["status", "circumstance"].includes(m.type)) ?? [];
                const totalMod = applyStackingRules(source);
                const attribute = CONFIG.PF2E.savingThrowDefaultAttributes[saveType];
                const selectors = [saveType, `${attribute}-based`, "saving-throw", "all"];
                const stat = new Statistic(this, {
                    slug: saveType,
                    label: game.i18n.localize(CONFIG.PF2E.saves[saveType]),
                    domains: selectors,
                    modifiers: [new ModifierPF2e(`PF2E.MasterSavingThrow.${saveType}`, totalMod, "untyped")],
                    check: { type: "saving-throw" },
                });

                return { ...partialSaves, [saveType]: stat };
            },
            {} as Record<SaveType, Statistic>,
        );

        this.system.saves = SAVE_TYPES.reduce(
            (partial, saveType) => ({ ...partial, [saveType]: this.saves[saveType].getTraceData() }),
            {} as CreatureSaves,
        );

        // Attack
        this.attackStatistic = new Statistic(this, {
            slug: "attack-roll",
            label: "PF2E.Familiar.AttackRoll",
            modifiers: [new ModifierPF2e("PF2E.MasterLevel", masterLevel, "untyped")],
            check: { type: "attack-roll" },
        });

        this.system.attack = this.attackStatistic.getTraceData();

        // Perception
        this.perception = new PerceptionStatistic(this, {
            slug: "perception",
            label: "PF2E.PerceptionLabel",
            attribute: "wis",
            domains: ["perception", "wis-based", "all"],
            modifiers: [
                new ModifierPF2e("PF2E.MasterLevel", masterLevel, "untyped"),
                new ModifierPF2e(`PF2E.MasterAbility.${system.master.ability}`, masterAttributeModifier, "untyped"),
            ],
            check: { type: "perception-check" },
            senses: system.perception.senses,
        });
        system.perception = fu.mergeObject(this.perception.getTraceData(), { attribute: "wis" as const });

        // Skills
        this.skills = [...SKILL_SLUGS].reduce((builtSkills: Record<string, Statistic<this>>, skill) => {
            const modifiers = [new ModifierPF2e("PF2E.MasterLevel", masterLevel, "untyped")];
            if (["acrobatics", "stealth"].includes(skill)) {
                const label = `PF2E.MasterAbility.${system.master.ability}`;
                modifiers.push(new ModifierPF2e(label, masterAttributeModifier, "untyped"));
            }

            const attribute = SKILL_EXPANDED[skill].attribute;
            const domains = [skill, `${attribute}-based`, "skill-check", "all"];

            const label = CONFIG.PF2E.skillList[skill] ?? skill;
            const statistic = new Statistic(this, {
                slug: skill,
                label,
                attribute,
                domains,
                modifiers,
                lore: false,
                check: { type: "skill-check" },
            });

            builtSkills[skill] = statistic;
            this.system.skills[skill] = fu.mergeObject(statistic.getTraceData(), { attribute });

            return builtSkills;
        }, {});
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** Detect if a familiar is being reassigned from a master */
    protected override async _preUpdate(
        changed: DeepPartial<this["_source"]>,
        operation: FamiliarUpdateOperation<TParent>,
        user: UserPF2e,
    ): Promise<boolean | void> {
        const newId = changed.system?.master?.id ?? this.system.master.id;
        if (newId !== this.system.master.id) {
            operation.previousMaster = this.master?.uuid;
        }

        return super._preUpdate(changed, operation, user);
    }

    /** Remove familiar from former master if the master changed */
    protected override _onUpdate(
        changed: DeepPartial<this["_source"]>,
        operation: FamiliarUpdateOperation<TParent>,
        userId: string,
    ): void {
        super._onUpdate(changed, operation, userId);

        if (operation.previousMaster && operation.previousMaster !== this.master?.uuid) {
            const previousMaster = fromUuidSync<ActorPF2e>(operation.previousMaster);
            if (previousMaster?.isOfType("character")) {
                previousMaster.familiar = null;
            }
        }
    }

    /** Remove the master's reference to this familiar */
    protected override _onDelete(operation: DatabaseDeleteOperation<TParent>, userId: string): void {
        if (this.master) this.master.familiar = null;
        super._onDelete(operation, userId);
    }
}

interface FamiliarPF2e<TParent extends TokenDocumentPF2e | null = TokenDocumentPF2e | null>
    extends CreaturePF2e<TParent> {
    readonly _source: FamiliarSource;
    system: FamiliarSystemData;
}

interface FamiliarUpdateOperation<TParent extends TokenDocumentPF2e | null> extends ActorUpdateOperation<TParent> {
    previousMaster?: ActorUUID;
}

export { FamiliarPF2e };
