import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { ConfigService } from 'common/config';

import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';
import { glyphNumbers, simpleNumbers, phrase } from './assets/nft.parts';
import { gray } from './assets/nft.background';
import { formatUnits } from 'ethers';

@Injectable()
export class NFTService {
  constructor(
    protected readonly configService: ConfigService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getNftMeta(params: NFTParamsDto, query: NFTOptionsDto): Promise<NFTDto | null> {
    const name = await this.contract.name();
    const symbol = await this.contract.symbol();

    const meta = {
      name: name,
      description: symbol,
      image: `data:image/svg+xml;base64,${Buffer.from(this.generateSvgImage(params, query)).toString('base64')}`,
    };
    return meta;
  }

  async getNftImage(params: NFTParamsDto, query): Promise<string> {
    return this.generateSvgImage(params, query);
  }

  convertFromWei(amountInWei): string {
    const amountInGwei = parseFloat(formatUnits(amountInWei.toString(), 'gwei'));
    const amountInEth = parseFloat(formatUnits(amountInWei.toString(), 'ether'));

    if (amountInEth >= 1) {
      return parseFloat(amountInEth.toFixed(6)) + ' ETH';
    } else if (amountInGwei >= 1) {
      return parseFloat(amountInGwei.toFixed(2)) + ' GWEI';
    } else {
      return amountInWei + ' WEI';
    }
  }

  // function for generate amount on svg by glyphNumbers
  private generateAmountSvg(amount: string) {
    let result = '';
    let space = 0;
    for (let i = 0; i < amount.length; i++) {
      result += `<g transform="matrix(1,0,0,1,${space},0)" opacity="1" style="display: block;">${
        glyphNumbers[amount[i]]
      }</g>`;
      if (amount[i] === '1' || amount[i] === '.') space += 100;
      else space += 200;
    }
    return { result, size: space };
  }

  private generateAmountLineSvg(amount: string, x: number) {
    const { result, size } = this.generateAmountSvg(amount);
    let line = '';

    line += `
      <g transform="matrix(0,-1,1,0,${x},0)" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      <g transform="matrix(0,-1,1,0,${x},${size + 200})" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      <g transform="matrix(0,-1,1,0,${x},${size * 2 + 200 * 2})" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      <g transform="matrix(0,-1,1,0,${x},${-size - 200})" opacity="1" style="display: block;">
        <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${result}
        </g>
      </g>
      `;

    return { line, size };
  }

  generateSvgImage(params: NFTParamsDto, query: NFTOptionsDto): string {
    // TODO: implement svg generation
    const { status, amount, created_at } = query;
    const tokenId = Number(params.tokenId);

    const convertedAmount = this.convertFromWei(amount);

    const left = this.generateAmountLineSvg(convertedAmount, 0);
    const right = this.generateAmountLineSvg(convertedAmount, 1880);

    const lineAnimationDuration = 14;
    const textColor = status === 'pending' ? 'gray' : 'red';

    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"
  preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);">
      <image width="2000px" height="2000px" preserveAspectRatio="xMidYMid slice" xlink:href="${gray}"></image>
      <g clip-path="url(#__lottie_element_172)" opacity="1" style="display: block;" fill="${textColor}">
        <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 ${
          left.size * 2 + 200 * 2
        }"
         to="0 0" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"></animateTransform>
        ${left.line}
      </g>
      <g clip-path="url(#__lottie_element_172)" opacity="1" style="display: block;" fill="${textColor}">
        <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 0" to="0 ${
          right.size * 2 + 200 * 2
        }" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"></animateTransform>
          ${right.line}
      </g>
      <g transform="matrix(1,0,0,1,1025,1500)" opacity="1" style="display: block;" fill="${textColor}">
        ${phrase}
      </g>
    </svg>
    `;

    return svgString;
  }
}
