import { Button } from '@/components/ui/button'
import React from 'react'

export default function TopNavbar() {
    return (
        <div className='flex justify-between p-3'>
            <div className='text-lg font-bold '>
                Feta Games
            </div>
            <div className='flex space-x-1'>

                <Button variant='outline' size="sm">100 ETB</Button>
                <Button size="sm">Deposit</Button>
            </div>
        </div>
    )
}
