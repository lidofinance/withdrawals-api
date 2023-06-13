import { convertFromWei } from './nft.utils';

describe('convertFromWei', () => {
  it('should convert from wei to ETH', () => {
    expect(convertFromWei('1000000000000000000')).toEqual('1 ETH');
  });

  it('should convert from wei to GWEI', () => {
    expect(convertFromWei('1000000000')).toEqual('1 GWEI');
  });

  it('should convert from wei to WEI', () => {
    expect(convertFromWei('100')).toEqual('100 WEI');
  });

  it('should add prefix to the converted amount', () => {
    expect(convertFromWei('1000000000000000000', 'PREFIX')).toEqual('1 PREFIXETH');
  });

  it('should convert a very small amount to WEI', () => {
    expect(convertFromWei('1')).toEqual('1 WEI');
  });

  it('should convert a very large amount to ETH', () => {
    expect(convertFromWei('1000000000000000000000000')).toEqual('1000000 ETH');
  });

  it('should convert a very small amount with prefix to WEI', () => {
    expect(convertFromWei('1', 'PREFIX')).toEqual('1 WEI(STETH)');
  });

  it('should convert a very large amount with prefix to ETH', () => {
    expect(convertFromWei('1000000000000000000000000', 'PREFIX')).toEqual('1000000 PREFIXETH');
  });

  it('should handle the minimum value correctly', () => {
    expect(convertFromWei('0')).toEqual('0 WEI');
  });
});
