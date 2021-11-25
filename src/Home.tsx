import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import styled from 'styled-components';
import Countdown from 'react-countdown';
import { CircularProgress, Snackbar } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import * as anchor from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from './candy-machine';

import {
  MainContainer,
  DisplayContainer,
  InfoContainer,
  MintContainer,
  MintButton,
  ConnectButton,
} from './components';

const CounterText = styled.span``; // add your styles here
const DisplayImage = styled.img`
  min-width: 240px;
  max-width: 100%;
  border-radius: 1em;
  place-self: center;
`;
const Header = styled.div`
  font-size: 2rem;
  font-family: 'Josefin Sans';
  margin-bottom: 1rem;
  margin-left: 2.5rem;
`;
const Text = styled.div`
  font-size: 1.5rem;
  font-family: 'Cormorant';
`;
const MintText = styled(Text)`
  font-size: 2rem;
  margin-left: 6rem;
  margin-right: 6rem;
  font-family: monospace;
`;
const Title = styled.div`
  margin-top: 3rem;
  margin-bottom: 3rem;
  font-size: 4.5rem;
  line-height: 1;
  text-align: center;
  font-family: 'Josefin Sans';
  text-transform: uppercase;
`;
const SolanaBanner = styled.div`
  background: rgb(255, 0, 255);
  background: linear-gradient(
    90deg,
    rgba(255, 0, 255, 1) 0%,
    rgba(0, 255, 255, 1) 100%
  );
  padding-bottom: 0.75rem;
`;

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: '',
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  // images
  const [displayImageIndex, setDisplayImageIndex] = useState(0); // true when user got to press MINT
  const displayImagePaths = [
    '/2370.png',
    '/127.png',
    '/684.png',
    '/1893.png',
    '/1027.png',
    '/217.png',
    '/1185.png',
  ];

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRedeemed(itemsRedeemed);

      // set itemsRedeemed to be just under 777
      setIsSoldOut(itemsRedeemed >= 774);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          'singleGossip',
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: 'Congratulations! Mint succeeded!',
            severity: 'success',
          });
        } else {
          setAlertState({
            open: true,
            message: 'Mint failed! Please try again!',
            severity: 'error',
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || 'Minting failed! Please try again!';
      if (!error.msg) {
        if (error.message.indexOf('0x138')) {
        } else if (error.message.indexOf('0x137')) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf('0x135')) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: 'error',
      });
    } finally {
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  function useInterval(callback: () => void, delay: number | null) {
    const savedCallback = useRef(callback);

    // Remember the latest callback if it changes.
    useLayoutEffect(() => {
      savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
      // Don't schedule if no delay is specified.
      if (!delay) {
        return;
      }

      const id = setInterval(() => savedCallback.current(), delay);

      return () => clearInterval(id);
    }, [delay]);
  }

  useInterval(() => {
    if (displayImageIndex >= displayImagePaths.length - 1) {
      setDisplayImageIndex(0);
    } else {
      setDisplayImageIndex(displayImageIndex + 1);
    }
  }, 800);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <main>
      <SolanaBanner></SolanaBanner>
      <Title>fancy diamonds</Title>
      <MainContainer>
        <DisplayContainer>
          <DisplayImage
            id="display-img"
            src={displayImagePaths[displayImageIndex]}
            alt="Diamonds on display"
          ></DisplayImage>
        </DisplayContainer>
        <MintContainer>
          <MintText>
            {wallet && (
              <p>Wallet: {shortenAddress(wallet.publicKey.toBase58() || '')}</p>
            )}
            {wallet && <p>Cost: 0.5 SOL</p>}
            {wallet && <p>{isSoldOut ? 777 : itemsRedeemed} minted</p>}
          </MintText>

          {!wallet ? (
            <ConnectButton>connect wallet</ConnectButton>
          ) : (
            <MintButton
              disabled={isSoldOut || isMinting || !isActive}
              onClick={onMint}
              variant="contained"
            >
              {isSoldOut ? (
                'SOLD OUT'
              ) : isActive ? (
                isMinting ? (
                  <CircularProgress />
                ) : (
                  'mint'
                )
              ) : (
                <Countdown
                  date={startDate}
                  onMount={({ completed }) => completed && setIsActive(true)}
                  onComplete={() => setIsActive(true)}
                  renderer={renderCounter}
                />
              )}
            </MintButton>
          )}
        </MintContainer>
        <InfoContainer>
          <div>
            <Header>mint instructions</Header>
            <Text>
              <ol>
                <li>click "connect wallet".</li>
                <li>select the wallet you want to use.</li>
                <li>
                  when it's time to mint, hit the button!
                  <br />
                  your diamond will show up in your wallet 💎
                </li>
              </ol>
            </Text>
          </div>
        </InfoContainer>

        <Snackbar
          open={alertState.open}
          autoHideDuration={6000}
          onClose={() => setAlertState({ ...alertState, open: false })}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </MainContainer>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error' | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
