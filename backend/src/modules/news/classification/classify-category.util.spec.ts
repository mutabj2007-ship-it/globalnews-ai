import { classifyCategory } from './classify-category.util';

describe('classifyCategory', () => {
  it('trusts an explicit category hint over keyword matching', () => {
    expect(classifyCategory({ title: 'Senate votes on new bill' }, 'business')).toBe('business');
  });

  it('classifies politics stories from keywords', () => {
    expect(classifyCategory({ title: 'Senate votes on new bill' })).toBe('politics');
  });

  it('classifies business stories from keywords', () => {
    expect(
      classifyCategory({
        title: 'Stock market rallies after inflation report',
      }),
    ).toBe('business');
  });

  it('classifies technology stories from keywords', () => {
    expect(
      classifyCategory({
        title: 'New AI chip promises faster smartphone performance',
      }),
    ).toBe('technology');
  });

  it('classifies sports stories from keywords', () => {
    expect(
      classifyCategory({
        title: 'Team wins championship match in overtime',
      }),
    ).toBe('sports');
  });

  it('classifies entertainment stories from keywords', () => {
    expect(
      classifyCategory({
        title: 'New movie tops box office in opening weekend',
      }),
    ).toBe('entertainment');
  });

  it('falls back to world when nothing matches', () => {
    expect(
      classifyCategory({
        title: 'Renewed talks reported in Ceuta',
        summary: 'A regional update was released.',
      }),
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

  it('classifies Sudan peace negotiations as politics', () => {
    expect(
      classifyCategory({
        title: 'U.S.-brokered peace efforts for Sudan encounter new obstacles',
        summary:
          'The armed forces and paramilitary group remain divided over the proposed agreement.',
      }),
    ).toBe('politics');
  });

  it('classifies a Sudan proxy-war report as politics', () => {
    expect(
      classifyCategory({
        title: "Sudan is a 10-nation proxy war. Why are we pretending there's only one culprit?",
        summary: 'Foreign military support and weapons supply lines continue to delay peace.',
      }),
    ).toBe('politics');
  });

  it('classifies Red Cross humanitarian reporting as health', () => {
    expect(
      classifyCategory({
        title: 'Red Cross appeals for greater support as humanitarian needs deepen across Sudan',
        summary: 'Humanitarian organizations warn that food and medical needs continue to grow.',
      }),
    ).toBe('health');
  });

  it('classifies a deadly military strike as politics', () => {
    expect(
      classifyCategory({
        title: '35 killed after Sudan army launches drone strike on Darfur civil court',
        summary: 'The conflict involves the Sudanese military and paramilitary forces.',
      }),
    ).toBe('politics');
  });

  it('does not classify a surname-only result as politics or health', () => {
    expect(
      classifyCategory({
        title: 'Rajouri Student Nikhil Sudan Features In Official Poster Of Youth Campaign',
        summary: 'A Class XII student appeared in an official educational poster.',
      }),
    ).toBe('world');
  });

  it('gives title matches more weight than summary matches', () => {
    expect(
      classifyCategory({
        title: 'Government begins new peace negotiations',
        summary: 'The announcement was shared through a digital technology platform.',
      }),
    ).toBe('politics');
  });
});
