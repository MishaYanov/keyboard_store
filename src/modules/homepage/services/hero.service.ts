import type { IHeroContent } from '../models/homepage.types';

export class HeroService {
    public constructor(public readonly content: IHeroContent) {}
}
