import Image from 'next/image'
import type * as React from 'react'
import { PageHead } from './PageHead'
import styles from './styles.module.css'

export const ErrorPage: React.FC<{ statusCode: number }> = ({ statusCode }) => {
  const title = 'Error'

  return (
    <>
      <PageHead title={title} />
      <div className={styles.container}>
        <main className={styles.main}>
          <h1>Error Loading Page</h1>
          {statusCode && <p>Error code: {statusCode}</p>}
          <Image
            src='/error.png'
            alt='Error'
            className={styles.errorImage}
            width={1200}
          />
        </main>
      </div>
    </>
  )
}
