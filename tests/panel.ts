import { Component } from '../src/engine';
import { PanelComponent } from '../src/shared/panel';

let mounts = 0;
let unmounts = 0;
class ProjectedComponent extends Component<HTMLDivElement> {
    constructor() { super(document.createElement('div')); this.root.textContent = 'Projected component'; }
    protected override onMount(): void { mounts += 1; }
    protected override onUnmount(): void { unmounts += 1; }
}
const copy = document.createElement('h2');
copy.textContent = 'Projected text';
const visual = document.createElement('div');
visual.className = 'test-visual';
const projected = new ProjectedComponent();
const panel = new PanelComponent({
    text: [copy, projected], content: visual,
    classNames: { root: 'test-panel', text: 'test-copy' },
    desktop: {
        grid: { areas: '"visual copy"', gap: 12 },
        text: { gridArea: 'copy', zIndex: 2 },
        content: { gridArea: 'visual', zIndex: 5 },
    },
    mobile: {
        grid: { minHeight: 320 },
        text: { padding: 24, zIndex: 2 },
        content: { zIndex: 5 },
        mask: { mode: 'lighten', opacity: 0.4 },
    },
});
panel.mount(document.querySelector('#fixture')!);
const results = document.querySelector('#results')!;
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
function verify() {
    const root = panel.getRoot();
    const text = root.querySelector('.panel__text')!;
    const content = root.querySelector('.panel__content')!;
    const mobile = matchMedia('(max-width: 768px)').matches;
    assert(root.dataset.layout === (mobile ? 'mobile' : 'desktop'), 'Breakpoint selection');
    assert(text.contains(copy) && text.contains(projected.getRoot()), 'Projection identity');
    assert(mounts === 1 && unmounts === 0, 'Component not remounted on breakpoint');
    const mask = getComputedStyle(root.querySelector('.panel__mask')!);
    assert(mask.display === (mobile ? 'block' : 'none'), 'Mask visibility');
    if (mobile) {
        assert(Number(getComputedStyle(text).zIndex) > Number(getComputedStyle(content).zIndex), 'Mobile text stacking');
        assert(Math.abs(text.getBoundingClientRect().top - content.getBoundingClientRect().top) < 1, 'Mobile overlap');
        assert(mask.backgroundColor === 'rgb(255, 255, 255)' && mask.opacity === '0.4', 'Lighten mask');
    } else {
        assert(content.getBoundingClientRect().left < text.getBoundingClientRect().left, 'Named area placement');
    }
    results.textContent = `PASS: ${mobile ? 'mobile' : 'desktop'} projection, layout, mask, lifecycle`;
}
document.querySelector('#verify')!.addEventListener('click', verify);
document.querySelector('#dispose')!.addEventListener('click', () => {
    panel.unmount();
    assert(unmounts === 1 && !panel.getRoot().isConnected, 'Projected component cleanup');
    results.textContent = 'PASS: unmount and projected component cleanup';
});
verify();
