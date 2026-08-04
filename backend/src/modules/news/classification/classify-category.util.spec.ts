import { classifyCategory } from './classify-category.util';

describe('classifyCategory', () => {
  it('trusts an explicit category hint over keyword matching', () => {
    expect(
      classifyCategory({ title: 'Senate votes on new bill' }, 'business'),
    ).toBe('business');
  });

  it('classifies politics stories from keywords', () => {
    expect(classifyCategory({ title: 'Senate votes on new bill' })).toBe('politics');
  });

  it('classifies business stories from keywords', () => {
    expect(
      classifyCategory({ title: 'Stock market rallies after inflation report' }),
    ).toBe('business');
  });

  it('classifies technology stories from keywords', () => {
    expect(
      classifyCategory({ title: 'New AI chip promises faster smartphone performance' }),
    ).toBe('technology');
  });

  it('classifies sports stories from keywords', () => {
    expect(
      classifyCategory({ title: 'Team wins championship match in overtime' }),
    ).toBe('sports');
  });

  it('classifies entertainment stories from keywords', () => {
    expect(
      classifyCategory({ title: 'New movie tops box office in opening weekend' }),
    ).toBe('entertainment');
  });

  it('falls back to "world" when nothing matches', () => {
    expect(
      classifyCategory({ title: 'Renewed talks reported in Ceuta', summary: 'A diplomatic update.' }),
    ).toBe('world');
  });

  it('considers the summary as well as the title', () => {
    expect(
      classifyCategory({
        title: 'Regional update',
        summary: 'Doctors warn of a new vaccine shortage at local hospitals.',
      }),
    ).toBe('health');
  });
});
