import type {ComponentScope, ScopeCleanup} from '../component-scope';
import {
    effect,
    type EffectComputation,
    type EffectScheduler,
} from '../reactive/effect';

export interface DomBindingContext {
    scope: ComponentScope;
    scheduler: EffectScheduler;
}

export type TextBindingValue = string | number | null | undefined;
export type AttributeBindingValue = string | number | boolean | null | undefined;
export type StyleBindingValue = string | number | null | undefined;

export function bindText(context: DomBindingContext, target: Node, readValue: () => TextBindingValue): ScopeCleanup {
    return bindEffect(context, () => {
        const nextValue = String(readValue() ?? '');

        if (target.textContent !== nextValue) {
            target.textContent = nextValue;
        }
    });
}

export function bindAttribute(context: DomBindingContext, element: Element, name: string, readValue: () => AttributeBindingValue): ScopeCleanup {
    assertSafeBindingName(name);

    return bindEffect(context, () => {
        const value = readValue();
        const nextValue = value === true
            ? ''
            : value === false || value === null || value === undefined
                ? null
                : String(value);

        if (nextValue === null) {
            if (element.hasAttribute(name)) {
                element.removeAttribute(name);
            }

            return;
        }

        if (element.getAttribute(name) !== nextValue) {
            element.setAttribute(name, nextValue);
        }
    });
}

export function bindProperty<TElement extends Element, TKey extends keyof TElement> (
    context: DomBindingContext,
    element: TElement,
    name: TKey,
    readValue: () => TElement[TKey],
): ScopeCleanup {
    assertSafeBindingName(String(name));

    return bindEffect(context, () => {
        const nextValue = readValue();

        if (!Object.is(element[name], nextValue)) {
            element[name] = nextValue;
        }
    });
}

export function bindClass(context: DomBindingContext, element: Element, className: string, readEnabled: () => boolean): ScopeCleanup {
    return bindEffect(context, () => {
        const enabled = readEnabled();

        if (element.classList.contains(className) !== enabled) {
            element.classList.toggle(className, enabled);
        }
    });
}

export function bindStyle(context: DomBindingContext, element: HTMLElement, name: string, readValue: () => StyleBindingValue): ScopeCleanup {
    return bindEffect(context, () => {
        const value = readValue();
        const nextValue = value === null || value === undefined
            ? ''
            : String(value);

        if (name.startsWith('--') || name.includes('-')) {
            if (element.style.getPropertyValue(name) === nextValue) {
                return;
            }

            if (nextValue === '') {
                element.style.removeProperty(name);
            } else {
                element.style.setProperty(name, nextValue);
            }

            return;
        }

        const style = element.style as unknown as Record<string, unknown>;

        if (style[name] !== nextValue) {
            style[name] = nextValue;
        }
    });
}

function bindEffect(context: DomBindingContext, computation: EffectComputation): ScopeCleanup {
    const disposeEffect = effect(computation, {
        scheduler: context.scheduler,
    });

    return context.scope.add(disposeEffect);
}

function assertSafeBindingName(name: string): void {
    const normalizedName = name.toLowerCase();

    if (
        normalizedName === 'innerhtml'
        || normalizedName === 'outerhtml'
        || normalizedName.startsWith('on')
    ) {
        throw new Error(`Unsafe DOM binding: ${name}`);
    }
}
