import { MdOutlineShowChart } from "react-icons/md";
import { GameBarButton } from "../game/GameBar";
import LiveStats from "./LiveStats";
import { useState } from 'react';

const LiveStatsButton = () => {

    const [open, setOpen] = useState(false)
    return (
        <>
            <GameBarButton onClick={() => setOpen((open) => !open)} label={("liveStats.title")} >
                <MdOutlineShowChart />
            </GameBarButton>
            <LiveStats />
        </>
    );
};

export default LiveStatsButton;
