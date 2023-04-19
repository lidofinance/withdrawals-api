import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { formatUnits } from 'ethers';
import { ConfigService } from 'common/config';
import { QueueInfoStorageService } from 'storage';

import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';
import { glyphNumbers, simpleNumbers, phrase, crystalls, bgTwo, bgOne, lidoGray, ethColor } from './assets/nft.parts';

const ALLOWED_ID_LIST = [74, 415, 82, 92, 93];

@Injectable()
export class NFTService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly queueInfo: QueueInfoStorageService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getNftMeta(params: NFTParamsDto, query: NFTOptionsDto): Promise<NFTDto | null> {
    const name = this.queueInfo.getTokenName();
    const symbol = this.queueInfo.getTokenSymbol();

    const image = ALLOWED_ID_LIST.includes(Number(params.tokenId))
      ? `data:image/svg+xml;base64,${Buffer.from(this.generateSvgImage(params, query)).toString('base64')}`
      : null;

    const meta = {
      name: name,
      description: symbol,
      image,
    };
    return meta;
  }

  async getNftImage(params: NFTParamsDto, query): Promise<string> {
    return this.generateSvgImage(params, query);
  }

  convertFromWei(amountInWei: string, prefix?: string): string {
    const amountInGwei = parseFloat(formatUnits(amountInWei.toString(), 'gwei'));
    const amountInEth = parseFloat(formatUnits(amountInWei.toString(), 'ether'));

    if (amountInEth >= 1) {
      return `${parseFloat(amountInEth.toFixed(6))} ${prefix ? prefix : ''}ETH`;
    } else if (amountInGwei >= 1) {
      return `${parseFloat(amountInGwei.toFixed(2))} GWEI${prefix ? '(STETH)' : ''}`;
    } else {
      return `${amountInWei} WEI${prefix ? '(STETH)' : ''}`;
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
      if (amount[i] === '1' || amount[i] === '.' || amount[i] === ' ' || amount[i] === '(' || amount[i + 1] === '(')
        space += 100;
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

  private generateCrystallSvg(
    scrystall: string,
    animatonPath: string,
    position: { x: number; y: number },
    color: string,
  ) {
    return `
    <g transform="matrix(1,0.04,-0.04,1,${position.x},${position.y})" opacity="1" style="display: block;" fill="${color}">
      <animateMotion
        dur="10s"
        repeatCount="indefinite"
        path="${animatonPath}"/>
      ${scrystall}
    </g>
    `;
  }

  generateSvgImage(params: NFTParamsDto, query: NFTOptionsDto): string {
    // TODO: implement svg generation
    const { requested, created_at, finalized } = query;
    const tokenId = Number(params.tokenId);
    const isPending = !finalized;
    const prefix = isPending ? 'ST' : '';

    const token = isPending ? lidoGray : ethColor;
    const bg = isPending ? bgTwo : bgOne;
    // TODO: change real color by status
    const textColor = isPending ? 'gray' : 'red';
    const amount = isPending ? requested : finalized;

    const convertedAmount = this.convertFromWei(amount, prefix);

    const left = this.generateAmountLineSvg(convertedAmount, 0);
    const right = this.generateAmountLineSvg(convertedAmount, 1880);

    const lineAnimationDuration = 14;

    // TODO: add token id and time to svg

    // TODO: change crystalls by amount
    // TODO: update animation for crystalls
    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"
  preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);">
      ${bg}
      ${token}
      <g clip-path="url(#__lottie_element_172)" opacity="1" style="display: block;" fill="${textColor}">
        <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 ${
          left.size * 2 + 200 * 2
        }"
         to="0 0" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"/>
        ${left.line}
      </g>
      <g clip-path="url(#__lottie_element_172)" opacity="1" style="display: block;" fill="${textColor}">
        <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 0" to="0 ${
          right.size * 2 + 200 * 2
        }" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"/>
          ${right.line}
      </g>
      <g transform="matrix(1,0,0,1,1025,1500)" opacity="1" style="display: block;" fill="${textColor}">
        ${phrase}
      </g>
      ${this.generateCrystallSvg(
        crystalls[1],
        'M0,0,-50 -50,-150 -150,-250 -250,-150 -150,-50 -50,0, 0z',
        { x: 300, y: 1300 },
        textColor,
      )}
      ${this.generateCrystallSvg(
        crystalls[2],
        'M0,0,-50 50,-150 150,-250 250,-150 150,-50 50,0, 0z',
        { x: 1300, y: 1100 },
        textColor,
      )}
      ${this.generateCrystallSvg(
        crystalls[3],
        'M0,0,-50 50,-150 150,-250 250,-150 150,-50 50,0, 0z',
        { x: 300, y: -700 },
        textColor,
      )}
      ${this.generateCrystallSvg(
        crystalls[0],
        'M0,0,-50 -50,-150 -150,-250 -250,-150 -150,-50 -50,0, 0z',
        { x: 1300, y: -800 },
        textColor,
      )}
    </svg>
    `;

    return svgString;
  }
}
