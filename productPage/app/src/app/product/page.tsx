'use client'

import Button from '../../../../../shared/Button'
import styles from './page.module.css'

export default function Product() {

  return (
    <div className={styles.main}>
      <div>
      WELCOME TO THE PRODUCT PAGE!
      <br />
      <Button path='/home'/>
      </div>
    </div>
  )
}
