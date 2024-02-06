'use client'
import {useRouter} from 'next/navigation';

import React from 'react'

const Runscraper = () => {

    const router = useRouter();

    const handleClick = () => {
        router.refresh();
        router.push(`/?runScraperButton=${true}`);
    }

    return (
    <div>
        <button className='bg-pink-50 text-black rounded-lg py-3 px-5' onClick={handleClick}>
            Run Scraper
        </button>
    </div>
  )
}

export default Runscraper