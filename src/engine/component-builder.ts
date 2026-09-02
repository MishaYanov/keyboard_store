import {
    ComponentScope,
    type ScopeCleanup,
} from './component-scope';

export type ComponentChild =
    | Node
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly ComponentChild[];

export type ClassValue =
    | string
    | boolean
    | null
    | undefined
    | readonly ClassValue[];

export type AttributeValue = string | number | boolean | null | undefined;
export type StyleValue = string | number | null | undefined;
export type DatasetValue = string | number | boolean | null | undefined;

function isComponentChildArray(
    value: ComponentChild,
): value is readonly ComponentChild[] {
    return Array.isArray(value);
}

function isClassValueArray(
    value: ClassValue,
): value is readonly ClassValue[] {
    return Array.isArray(value);
}

export interface ElementOptions<TElement extends HTMLElement> {
    className?: ClassValue;
    attributes?: Readonly<Record<string, AttributeValue>>;
    properties?: Readonly<Record<string, unknown>>;
    style?: Readonly<Record<string, StyleValue>>;
    dataset?: Readonly<Record<string, DatasetValue>>;
    ref?: (element: TElement) => void | ScopeCleanup;
}

/**
 * Creates native DOM nodes and ties ref cleanups to a component scope.
 * It deliberately does not support innerHTML or inline event properties.
 */
export class ComponentBuilder {
    private readonly scope: ComponentScope;

    public constructor(scope: ComponentScope) {
        this.scope = scope;
    }

    public element<K extends keyof HTMLElementTagNameMap>(
        tagName: K,
        options: ElementOptions<HTMLElementTagNameMap[K]> = {},
        children: ComponentChild = [],
    ): HTMLElementTagNameMap[K] {
        const element = document.createElement(tagName);

        this.applyClassName(element, options.className);
        this.applyAttributes(element, options.attributes);
        this.applyProperties(element, options.properties);
        this.applyStyle(element, options.style);
        this.applyDataset(element, options.dataset);
        this.append(element, children);

        const cleanup = options.ref?.(element);

        if (typeof cleanup === 'function') {
            this.scope.add(cleanup);
        }

        return element;
    }

    public text(value: string | number): Text {
        return document.createTextNode(String(value));
    }

    public fragment(children: ComponentChild = []): DocumentFragment {
        const fragment = document.createDocumentFragment();

        this.append(fragment, children);

        return fragment;
    }

    public append(parent: Node, children: ComponentChild): void {
        if (isComponentChildArray(children)) {
            for (const child of children) {
                this.append(parent, child);
            }

            return;
        }

        if (children === null || children === undefined || typeof children === 'boolean') {
            return;
        }

        if (children instanceof Node) {
            parent.appendChild(children);

            return;
        }

        parent.appendChild(this.text(children));
    }

    private applyClassName(
        element: HTMLElement,
        className: ClassValue,
    ): void {
        const classNames = new Set<string>();

        this.collectClassNames(className, classNames);
        element.className = [...classNames].join(' ');
    }

    private collectClassNames(
        value: ClassValue,
        output: Set<string>,
    ): void {
        if (isClassValueArray(value)) {
            for (const entry of value) {
                this.collectClassNames(entry, output);
            }

            return;
        }

        if (typeof value !== 'string') {
            return;
        }

        for (const className of value.split(/\s+/)) {
            if (className !== '') {
                output.add(className);
            }
        }
    }

    private applyAttributes(
        element: HTMLElement,
        attributes: Readonly<Record<string, AttributeValue>> | undefined,
    ): void {
        for (const [name, value] of Object.entries(attributes ?? {})) {
            this.assertSafeName(name);

            if (value === null || value === undefined || value === false) {
                continue;
            }

            element.setAttribute(name, value === true ? '' : String(value));
        }
    }

    private applyProperties(
        element: HTMLElement,
        properties: Readonly<Record<string, unknown>> | undefined,
    ): void {
        const target = element as unknown as Record<string, unknown>;

        for (const [name, value] of Object.entries(properties ?? {})) {
            this.assertSafeName(name);

            target[name] = value;
        }
    }

    private applyStyle(
        element: HTMLElement,
        styles: Readonly<Record<string, StyleValue>> | undefined,
    ): void {
        const styleTarget = element.style as unknown as Record<string, unknown>;

        for (const [name, value] of Object.entries(styles ?? {})) {
            if (name.startsWith('--') || name.includes('-')) {
                if (value === null || value === undefined) {
                    element.style.removeProperty(name);
                } else {
                    element.style.setProperty(name, String(value));
                }

                continue;
            }

            styleTarget[name] = value === null || value === undefined
                ? ''
                : String(value);
        }
    }

    private applyDataset(
        element: HTMLElement,
        dataset: Readonly<Record<string, DatasetValue>> | undefined,
    ): void {
        for (const [name, value] of Object.entries(dataset ?? {})) {
            if (value === null || value === undefined) {
                delete element.dataset[name];
            } else {
                element.dataset[name] = String(value);
            }
        }
    }

    private assertSafeName(name: string): void {
        const normalizedName = name.toLowerCase();

        if (
            normalizedName === 'innerhtml'
            || normalizedName === 'outerhtml'
            || normalizedName.startsWith('on')
        ) {
            throw new Error(`Unsafe element field: ${name}`);
        }
    }
}
