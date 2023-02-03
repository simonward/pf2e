import { htmlQueryAll } from "@util";

/** Extend ItemDirectory to show more information */
export class ItemDirectoryPF2e<TItem extends Item> extends ItemDirectory<TItem> {
    static override get defaultOptions(): SidebarDirectoryOptions {
        const options = super.defaultOptions;
        options.renderUpdateKeys.push("system.details.level.value");
        return options;
    }

    override async getData(): Promise<object> {
        return {
            ...(await super.getData()),
            documentPartial: "systems/pf2e/templates/sidebar/item-document-partial.hbs",
        };
    }

    override activateListeners($html: JQuery<HTMLElement>): void {
        super.activateListeners($html);
        const html = $html[0];

        for (const element of htmlQueryAll(html, "li.directory-item.item")) {
            const item = game.items.get(element.dataset.documentId ?? "");
            if (!item?.testUserPermission(game.user, "OBSERVER")) {
                element.querySelector("span.item-level")?.remove();
            }
        }
    }

    /** Include flattened update data so parent method can read nested update keys */
    protected override async _render(force?: boolean, context: SidebarDirectoryRenderOptions = {}): Promise<void> {
        // Create new reference in case other applications are using the same context object
        context = deepClone(context);

        if (context.action === "update" && context.documentType === "Item" && context.data) {
            context.data = context.data.map((d) => ({ ...d, ...flattenObject(d) }));
        }

        return super._render(force, context);
    }
}
