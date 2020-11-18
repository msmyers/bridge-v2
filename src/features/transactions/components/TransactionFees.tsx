import React, { FunctionComponent, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { NumberFormatText } from '../../../components/formatting/NumberFormatText'
import { CenteredProgress } from '../../../components/progress/ProgressHelpers'
import { LabelWithValue } from '../../../components/typography/TypographyHelpers'
import { WalletStatus } from '../../../components/utils/types'
import { MINT_GAS_UNIT_COST } from '../../../constants/constants'
import { useSelectedChainWallet } from '../../../providers/multiwallet/multiwalletHooks'
import { BridgeCurrency, getCurrencyConfig, toReleasedCurrency, } from '../../../utils/assetConfigs'
import { fromGwei } from '../../../utils/converters'
import { useGasPrices } from '../../marketData/marketDataHooks'
import { $exchangeRates, $gasPrices } from '../../marketData/marketDataSlice'
import { findExchangeRate, USD_SYMBOL } from '../../marketData/marketDataUtils'
import { BridgeFees, getTransactionFees, useFetchFees } from '../../fees/feesUtils'
import { getFeeTooltips, TxType } from '../transactionsUtils'

type TransactionFeesProps = {
  type: TxType;
  currency: BridgeCurrency;
  amount: number;
};

export const getMintAndReleaseFees = (fees: BridgeFees) => {
  const result = {
    mint: 0,
    release: 0,
  };
  if (fees && fees[0] && fees[0].ethereum) {
    const chainFees = fees[0].ethereum;
    result.mint = chainFees.min;
    result.release = chainFees.burn;
  }
  return result;
};

export const TransactionFees: FunctionComponent<TransactionFeesProps> = ({
  amount,
  currency,
  type,
}) => {
  useGasPrices();
  const { status } = useSelectedChainWallet();
  const currencyConfig = getCurrencyConfig(currency);
  const exchangeRates = useSelector($exchangeRates);
  const gasPrices = useSelector($gasPrices);
  const currencyUsdRate = findExchangeRate(exchangeRates, currency, USD_SYMBOL);
  const ethUsdRate = findExchangeRate(
    exchangeRates,
    BridgeCurrency.ETH,
    USD_SYMBOL
  );
  const amountUsd = amount * currencyUsdRate;
  const { fees, pending } = useFetchFees(currency, type);
  const { renVMFee, renVMFeeAmount, networkFee } = getTransactionFees({
    amount,
    fees,
    type,
  });
  const renVMFeeAmountUsd = amountUsd * renVMFee;
  const networkFeeUsd = networkFee * currencyUsdRate;

  const destinationCurrency = toReleasedCurrency(currency);

  const tooltips = useMemo(() => {
    return getFeeTooltips({
      mintFee: fees.mint / 10000,
      releaseFee: fees.burn / 10000,
      sourceCurrency: currency,
      destinationCurrency: destinationCurrency,
      type: TxType.MINT,
    });
  }, [fees, currency, destinationCurrency]);

  const feeInGwei = Math.ceil(MINT_GAS_UNIT_COST * gasPrices.standard);
  const targetNetworkFeeUsd = fromGwei(feeInGwei) * ethUsdRate;
  const targetNetworkFeeLabel = `${feeInGwei} Gwei`;

  if (status !== WalletStatus.CONNECTED) {
    return <span>Connect a wallet to view fees</span>;
  }
  if (pending) {
    return <CenteredProgress />;
  }
  return (
    <>
      <LabelWithValue
        label="RenVM Fee"
        labelTooltip={tooltips.renVmFee}
        value={
          <NumberFormatText
            value={renVMFeeAmount}
            spacedSuffix={currencyConfig.short}
          />
        }
        valueEquivalent={
          <NumberFormatText
            value={renVMFeeAmountUsd}
            prefix="$"
            decimalScale={2}
            fixedDecimalScale
          />
        }
      />
      <LabelWithValue //TODO: made dependant on the chain
        label={`Bitcoin Miner Fee`}
        labelTooltip={tooltips.bitcoinMinerFee}
        value={<NumberFormatText value={networkFee} spacedSuffix="BTC" />}
        valueEquivalent={
          <NumberFormatText
            value={networkFeeUsd}
            prefix="$"
            decimalScale={2}
            fixedDecimalScale
          />
        }
      />
      <LabelWithValue
        label="Esti. Ethereum Fee"
        labelTooltip={tooltips.estimatedEthFee}
        value={targetNetworkFeeLabel}
        valueEquivalent={
          <NumberFormatText
            value={targetNetworkFeeUsd}
            prefix="$"
            decimalScale={2}
            fixedDecimalScale
          />
        }
      />
    </>
  );
};
