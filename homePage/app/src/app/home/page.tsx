'use client'

import Button from '../../../../../shared/Button'
import styles from './page.module.css'

export default function Home() {

  return (
    <div className={styles.main}>
      <div>
      WELCOME TO THE HOME PAGE!
      <br />
      <Button path='/product'/>
      </div>
    </div>
  )
}
